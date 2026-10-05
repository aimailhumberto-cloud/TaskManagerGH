import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import nodemailer from 'nodemailer';
import postcss from 'postcss';

async function main() {
  // No .env loading, SMTP connection, external messages or production database access.
  const expected = { next: '15.5.27', react: '19.1.9', 'react-dom': '19.1.9', nodemailer: '10.0.15', postcss: '8.5.29', nanoid: '3.3.20' };
  for (const [name, version] of Object.entries(expected)) assert.equal(JSON.parse(await readFile(join('node_modules', name, 'package.json'), 'utf8')).version, version);
  await mkdir('.local-data', { recursive: true });
  const directory = await mkdtemp(join('.local-data', 'security-fixture-'));
  const cssDirectory = join(directory, 'project', 'css'); await mkdir(cssDirectory, { recursive: true });
  const marker = 'ISOLATED_MAP_CONTENT_MUST_NOT_LEAK';
  const mapPath = resolve(directory, 'private.map');
  await writeFile(mapPath, JSON.stringify({ version: 3, sources: ['private.js'], names: [], mappings: 'AAAA', sourcesContent: [marker] }));
  for (const [annotation, options] of [['../../private.map', { from: join(cssDirectory, 'input.css') }], [mapPath.replaceAll('\\', '/'), {}]] as const) {
    const result = await postcss().process(`a{color:red} /*# sourceMappingURL=${annotation} */`, options);
    assert(!(result.map?.toString() || '').includes(marker));
    assert(!(result.root.source?.input.map?.text || '').includes(marker));
  }
  const normal = await postcss().process('a{color:red}', { from: undefined }); assert(normal.css.includes('color:red'));
  const nano = spawnSync(process.execPath, ['--input-type=module', '-e', "import {nanoid,customAlphabet} from 'nanoid/non-secure';if(nanoid(-1)!==''||customAlphabet('abc')(0)!=='')process.exit(2);"], { timeout: 3000, encoding: 'utf8' });
  assert.equal(nano.status, 0, 'Patched negative/zero sizes must terminate'); assert(!nano.error);
  const parser = spawnSync(process.execPath, ['-e', "const parse=require('nodemailer/lib/addressparser');parse(' >'+' >[x][x]'.repeat(40000));parse(Array.from({length:3000},(_,i)=>'g'+i+':').join(' ')+' test@example.invalid;');"], { timeout: 8000, encoding: 'utf8' });
  assert.equal(parser.status, 0, 'Patched malformed address parsing must terminate without stack failure'); assert(!parser.error);
  const transport = nodemailer.createTransport({ streamTransport: true, buffer: true, newline: 'unix', disableFileAccess: true, disableUrlAccess: true });
  const message = await transport.sendMail({ from: 'sender@example.invalid', to: 'recipient@example.invalid', subject: 'Isolated compatibility', text: 'No actual email is sent', attachments: [{ filename: 'invite.ics', content: 'BEGIN:VCALENDAR\nEND:VCALENDAR', contentType: 'text/calendar' }] });
  assert(Buffer.isBuffer(message.message)); assert(message.message.toString().includes('Isolated compatibility')); assert(message.message.toString().includes('invite.ics'));
  await assert.rejects(transport.sendMail({ from: 'sender@example.invalid', to: 'recipient@example.invalid', raw: { path: mapPath } }), /file|access|disabled/i);
  transport.close();
  console.log('PASS patched dependency versions; PostCSS traversal/no-from isolation; nanoid zero/negative termination; Nodemailer malformed-address/stack regression, memory-only mail+ICS and raw file-access rejection. No SMTP or external writes.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
