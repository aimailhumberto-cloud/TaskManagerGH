import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createHash, createHmac, randomBytes, pbkdf2Sync } from 'node:crypto';
import { chromium } from '@playwright/test';

const origin = 'http://127.0.0.1:47917', root = resolve('.local-data/smj-center-qa'); mkdirSync(root, { recursive: true });
if (['.env', '.env.local', '.env.production', '.env.production.local'].some(existsSync)) throw Error('No service environment files allowed');
try { await fetch(origin, { signal: AbortSignal.timeout(500) }); throw Error('Test port occupied'); } catch (e) { if (e.message === 'Test port occupied') throw e; }
const previewBefore = readFileSync('.local-data/preview.json');
const secret = randomBytes(48).toString('hex'), salt = 'synthetic-smj-only';
const fixture = { companies: [{ id: 'business-sm-jaleel', name: 'S.M. Jaleel' }, { id: 'other-business', name: 'OTHER COMPANY PRIVATE' }], people: [{ id: 'synthetic-hb', name: 'SYNTHETIC HB', role: 'Owner', avatar: '' }, { id: 'synthetic-reader', name: 'SYNTHETIC Reader', role: 'Gerente', avatar: '' }], users: [{ id: 'synthetic-owner-user', personId: 'synthetic-hb', email: 'owner@smj.test', passwordHash: pbkdf2Sync('synthetic-only', salt, 1000, 64, 'sha512').toString('hex'), salt, isActive: true }, { id: 'synthetic-reader-user', personId: 'synthetic-reader', email: 'reader@smj.test', passwordHash: '', salt: '', isActive: true }], tasks: [], projects: [], templates: [], agentQueue: [], smtpConfig: { host: '', port: 587, secure: false, user: '', pass: '' }, automations: [], reminders: [] };
const task = { id: 'fixture-smj', title: 'SYNTHETIC Revisión SMJ', description: 'Synthetic data only', companyId: 'business-sm-jaleel', type: 'One-shot', ownerId: 'synthetic-hb', assigneeId: 'synthetic-hb', assigneeIds: ['synthetic-hb'], status: 'Pending', priority: 'Medium', origin: 'Manual', dueDate: '', workDate: '2026-11-03', category: 'Ventas', subcategories: ['Canadá'], steps: [], activityLog: [], attachments: [{ id: 'synthetic-attachment', filename: 'synthetic-evidence.txt', filepath: '/data/attachments/synthetic-evidence.txt', uploadedAt: new Date().toISOString() }], revision: 1, nextAction: 'SYNTHETIC revisar evidencia', sourceUrl: 'https://mail.google.com/mail/u/0/#all/synthetic-smj' };
fixture.tasks.push(task, { ...task, id: 'fixture-other', title: 'OTHER COMPANY PRIVATE TASK', companyId: 'other-business', assigneeId: 'synthetic-reader', assigneeIds: ['synthetic-reader'], ownerId: 'synthetic-reader', attachments: [], sourceUrl: 'https://mail.google.com/mail/u/0/#all/other-company' });
writeFileSync(resolve(root, 'synthetic-evidence.txt'), 'Synthetic evidence only');
const database = resolve(root, 'database.json'); writeFileSync(database, JSON.stringify(fixture));
const env = { ...process.env, DATABASE_PATH: database, SESSION_SECRET: secret, TASKMANAGER_LOCAL_ONLY: '0', TASKMANAGER_EXTERNAL_ACTIONS_ENABLED: '0', TASKMANAGER_ATTACHMENTS_DIRECTORY: root, NODE_ENV: 'production', NEXT_TELEMETRY_DISABLED: '1' };
for (const key of Object.keys(env)) if (/SUPABASE|SMTP|TELEGRAM|API_KEY|SERVICE_ROLE|OPENAI|ANTHROPIC|GOOGLE|WHATSAPP/.test(key)) delete env[key];
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '-H', '127.0.0.1', '-p', '47917'], { env, stdio: ['ignore', 'ignore', 'ignore'] });
let browser;
const token = (userId, personId) => { const payload = Buffer.from(JSON.stringify({ userId, personId, role: 'Owner', email: 'synthetic@smj.test', createdAt: new Date().toISOString() })).toString('base64url'); return payload + '.' + createHmac('sha256', secret).update(payload).digest('base64url'); };
try {
  let ready = false; for (let i = 0; i < 80; i++) { if (server.exitCode !== null) throw Error('Test server stopped'); try { if ((await fetch(origin + '/login')).ok) { ready = true; break; } } catch {} await new Promise(r => setTimeout(r, 200)); } assert(ready);
  const login = await fetch(origin + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'owner@smj.test', password: 'synthetic-only' }) }); assert.equal(login.status, 200); assert(/Secure/i.test(login.headers.get('set-cookie')));
  browser = await chromium.launch({ headless: true }); const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  await context.addCookies([{ name: 'hermes_session', value: token('synthetic-owner-user', 'synthetic-hb'), url: origin, httpOnly: true, secure: true, sameSite: 'Lax' }]);
  const page = await context.newPage(); const pageErrors = []; page.on('pageerror', e => pageErrors.push(e.message));
  const center = () => page.getByRole('region', { name: 'Centro de control de S.M. Jaleel' });
  const switchTab = async name => { await center().getByRole('tab', { name, exact: true }).click(); await assertSelected(name); };
  const assertSelected = async name => assert.equal(await center().getByRole('tab', { name, exact: true }).getAttribute('aria-selected'), 'true');
  await page.goto(origin + '/empresas?company=business-sm-jaleel', { waitUntil: 'networkidle' }); await center().waitFor();
  assert.equal(await center().getByRole('tab').count(), 7); assert(!(await center().textContent()).includes('OTHER COMPANY PRIVATE'));
  await center().getByRole('button', { name: /SYNTHETIC Revisión SMJ/ }).click();
  const form = page.getByRole('form', { name: 'Editar trabajo' }); await form.locator('input[name="title"]').fill('SYNTHETIC Revisión SMJ actualizada'); await form.locator('input[name="reason"]').fill('Synthetic center edit'); await form.getByRole('button', { name: 'Guardar trabajo' }).click(); await page.getByRole('status').filter({ hasText: 'Cambio guardado' }).waitFor();
  await page.getByRole('button', { name: 'Cerrar detalle', exact: true }).click(); await page.reload({ waitUntil: 'networkidle' });
  let saved = JSON.parse(readFileSync(database, 'utf8')); assert.equal(saved.tasks.find(t => t.id === task.id).title, 'SYNTHETIC Revisión SMJ actualizada'); assert.equal(saved.tasks.length, 2);
  await switchTab('Trabajo'); await center().getByLabel('Nueva tarea', { exact: true }).fill('SYNTHETIC Captura desde SMJ'); await center().getByRole('button', { name: /Añadir/ }).click();
  await page.waitForFunction(() => document.querySelector('input[aria-label="Nueva tarea"]')?.value === ''); saved = JSON.parse(readFileSync(database, 'utf8')); const captured = saved.tasks.filter(t => t.title === 'SYNTHETIC Captura desde SMJ'); assert.equal(captured.length, 1); assert.equal(captured[0].companyId, 'business-sm-jaleel');
  await center().getByLabel('Mercado de SMJ').selectOption('Canada'); await switchTab('Comunicaciones'); assert(!(await center().textContent()).includes('OTHER COMPANY PRIVATE')); assert.equal(await center().locator('a[href*="synthetic-smj"]').count(), 1);
  await switchTab('Archivos'); const attachment = center().locator('a[href="/data/attachments/synthetic-evidence.txt"]'); assert.equal(await attachment.count(), 1); const attachmentResponse = await context.request.get(origin + '/data/attachments/synthetic-evidence.txt'); assert.equal(attachmentResponse.status(), 200); assert.equal(await attachmentResponse.text(), 'Synthetic evidence only');
  await page.reload({ waitUntil: 'networkidle' }); await assertSelected('Archivos'); assert.equal(await center().getByLabel('Mercado de SMJ').inputValue(), 'Canada');
  await center().getByLabel('Mercado de SMJ').selectOption('USA'); await switchTab('Trabajo'); assert.equal(await center().locator('tbody .tm-work-card').count(), 0); assert(!(await center().textContent()).includes('SYNTHETIC Revisión SMJ actualizada'));
  await center().getByRole('button', { name: 'Limpiar filtros' }).click();
  for (const viewport of [{ width: 1440, height: 1000 }, { width: 390, height: 844 }, { width: 320, height: 740 }]) {
    await page.setViewportSize(viewport);
    for (const name of ['Resumen', 'Trabajo', 'Agenda', 'Distribuidores', 'Indicadores', 'Comunicaciones', 'Archivos']) { await switchTab(name); assert(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), name + ' horizontal overflow'); assert(!(await center().textContent()).includes('OTHER COMPANY PRIVATE')); }
    await switchTab('Resumen'); await page.screenshot({ path: resolve(root, 'summary-' + viewport.width + '.png'), fullPage: true });
  }
  await switchTab('Indicadores'); await center().getByRole('button', { name: 'Scorecard', exact: true }).click(); assert((await center().textContent()).includes('Sin evaluar')); assert(!(await center().textContent()).includes('0 %')); await center().getByRole('button', { name: 'Hipótesis', exact: true }).click(); assert((await center().textContent()).includes('No representan ventas reales'));
  await center().getByRole('tab', { name: 'Indicadores', exact: true }).focus(); await page.keyboard.press('End'); await assertSelected('Archivos'); await page.keyboard.press('Home'); await assertSelected('Resumen');
  await page.goto(origin + '/empresas?company=business-sm-jaleel&tab=unexpected', { waitUntil: 'networkidle' }); await assertSelected('Resumen');
  const reader = await browser.newContext(); await reader.addCookies([{ name: 'hermes_session', value: token('synthetic-reader-user', 'synthetic-reader'), url: origin, httpOnly: true, secure: true, sameSite: 'Lax' }]); const readerPage = await reader.newPage(); await readerPage.goto(origin + '/empresas?company=business-sm-jaleel', { waitUntil: 'networkidle' }); assert(!(await readerPage.content()).includes('SYNTHETIC Revisión SMJ')); assert.equal(await readerPage.getByRole('region', { name: 'Centro de control de S.M. Jaleel' }).count(), 0); await reader.close();
  assert.deepEqual(pageErrors, []); assert.deepEqual(readFileSync('.local-data/preview.json'), previewBefore);
  const report = { at: new Date().toISOString(), compiledBuild: true, syntheticOnly: true, sevenTabs: true, sharedTaskIdEditPersists: true, captureSingleRecordCorrectCompany: true, sourceLinksAndAttachmentAuthorized: true, filtersPersistAcrossTabsAndReload: true, otherCompanyExcluded: true, unauthorizedProfileExcluded: true, keyboardTabsAndUnknownTabFallback: true, desktop1440Mobile390Mobile320: true, noHorizontalOverflow: true, noInventedResultsOrDistributors: true, previewSha256: createHash('sha256').update(previewBefore).digest('hex'), productionChanged: false };
  writeFileSync(resolve(root, 'report.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));
} finally { if (browser) await browser.close(); if (process.platform === 'win32') { const stop = spawn('taskkill', ['/PID', String(server.pid), '/T', '/F'], { stdio: 'ignore' }); await new Promise(r => stop.once('exit', r)); } else server.kill('SIGTERM'); }
