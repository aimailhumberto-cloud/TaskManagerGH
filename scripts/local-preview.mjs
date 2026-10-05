import { spawn } from 'node:child_process';
import { mkdirSync, existsSync, writeFileSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pbkdf2Sync, randomBytes } from 'node:crypto';

// This launcher never uses versioned data or a service credential.
if (['.env', '.env.local', '.env.development', '.env.development.local', '.env.production', '.env.production.local', '.env.test', '.env.test.local'].some(existsSync)) {
  throw new Error('Isolated preview requires a checkout without service .env files.');
}
const testing = process.argv.includes('--test');
const database = resolve('.local-data', testing ? 'ui-test.json' : 'preview.json');
mkdirSync(resolve('.local-data'), { recursive: true });
if (testing || !existsSync(database)) {
  const salt = 'local-preview-only';
  writeFileSync(database, JSON.stringify({
    companies: [{ id: 'local-personal', name: 'Personal' }, { id: 'local-business', name: 'Negocio de prueba' }],
    people: [{ id: 'local-humberto', name: 'Humberto', role: 'Admin', avatar: '' }, { id: 'local-colleague', name: 'Colaborador de prueba', role: 'Member', avatar: '' }],
    tasks: [], templates: [], agentQueue: [], smtpConfig: { host: '', port: 587, secure: false, user: '', pass: '' },
    users: [{ id: 'local-user', personId: 'local-humberto', email: 'humberto@local.test', passwordHash: pbkdf2Sync('preview-local-only', salt, 1000, 64, 'sha512').toString('hex'), salt, isActive: true }, ...(testing ? [{ id: 'local-reader', personId: 'local-colleague', email: 'reader@local.test', passwordHash: pbkdf2Sync('reader-local-only', salt, 1000, 64, 'sha512').toString('hex'), salt, isActive: true }] : [])],
  }, null, 2));
}
const secretFile = resolve('.local-data', testing ? 'ui-session-secret' : 'preview-session-secret');
if (!existsSync(secretFile)) writeFileSync(secretFile, randomBytes(48).toString('hex'), { mode: 0o600 });
const environment = { ...process.env, DATABASE_PATH: database, SESSION_SECRET: readFileSync(secretFile, 'utf8'), TASKMANAGER_LOCAL_ONLY: '1', NEXT_TELEMETRY_DISABLED: '1' };
for (const key of Object.keys(environment)) {
  if (/SUPABASE|SMTP|TELEGRAM|API_KEY|SERVICE_ROLE|OPENAI|ANTHROPIC/i.test(key)) delete environment[key];
}
const port = testing ? '47915' : '3011';
if (process.argv.includes('--prepare-only')) process.exit(0);
console.log(`Isolated preview: http://127.0.0.1:${port}; account humberto@local.test / preview-local-only`);
const command = process.argv.includes('--build') ? ['build'] : ['dev', '-H', '127.0.0.1', '-p', port];
const child = spawn(process.execPath, ['node_modules/next/dist/bin/next', ...command], { env: environment, stdio: 'inherit' });
child.on('exit', code => process.exit(code ?? 1));
if (process.platform !== 'win32') {
  for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { child.kill(signal); process.exit(0); });
}
