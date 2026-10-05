import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { spawn } from 'node:child_process';
const temporary = resolve('.local-data', 'temp');
mkdirSync(temporary, { recursive: true });
const child = spawn(process.execPath, ['node_modules/@playwright/test/cli.js', 'test', '-c', 'playwright.personal.config.ts', ...process.argv.slice(2)], { stdio: 'inherit', env: { ...process.env, TMP: temporary, TEMP: temporary } });
child.on('exit', code => process.exit(code ?? 1));
