import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
const origin = 'http://127.0.0.1:47915';
const previewBefore = readFileSync('.local-data/preview.json');
try { await fetch(origin, { signal: AbortSignal.timeout(500) }); throw new Error('Test port already occupied'); }
catch (error) { if (error.message === 'Test port already occupied') throw error; }
const server = spawn(process.execPath, ['scripts/local-preview.mjs', '--test', '--start'], { stdio: ['ignore', 'ignore', 'ignore'], env: { ...process.env, NODE_ENV: 'production' } });
try {
  let ready = false;
  for (let i = 0; i < 60; i++) {
    if (server.exitCode !== null) throw new Error('Isolated production server exited');
    try { if ((await fetch(origin + '/login', { signal: AbortSignal.timeout(1000) })).ok) { ready = true; break; } } catch {}
    await new Promise(resolve => setTimeout(resolve, 250));
  }
  assert(ready, 'Production build must become ready');
  // Only isolated fixture: exercise verified legacy Owner role without changing it to Admin.
  const fixture=JSON.parse(readFileSync('.local-data/ui-test.json','utf8'));
  fixture.people.find(p=>p.id==='local-humberto').role='Owner';
  writeFileSync('.local-data/ui-test.json',JSON.stringify(fixture));
  assert.equal((await fetch(origin + '/api/workspace')).status, 401);
  const login = await fetch(origin + '/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'humberto@local.test', password: 'preview-local-only' }) });
  assert.equal(login.status, 200);
  const header = login.headers.get('set-cookie') || '';
  assert(/HttpOnly/i.test(header)); assert(/Secure/i.test(header)); assert(/SameSite=Lax/i.test(header));
  const cookie = header.split(';')[0]; assert(cookie.startsWith('hermes_session='));
  // Manually carry the synthetic cookie to loopback HTTP; no cookie/security downgrade.
  // This verifies production code and flags, NOT hosted HTTPS/proxy behavior.
  const headers = { cookie };
  const workspace = await fetch(origin + '/api/workspace', { headers }); assert.equal(workspace.status, 200);
  const json = await workspace.json(); assert.equal(json.localOnly, true); assert.equal(json.tasks.length, 0);
  assert.equal((await fetch(origin + '/api/tasks/missing', { headers })).status, 404); // Promise params in compiled route.
  assert.equal((await fetch(origin + '/data/attachments/missing.txt', { headers })).status, 404);
  for (const path of ['/', '/empresas', '/agenda', '/buscar', '/whatsapp']) {
    const response = await fetch(origin + path, { headers }); assert.equal(response.status, 200);
    assert((await response.text()).includes('TASKMANAGER'));
  }
  const gateway = await fetch(origin + '/api/integrations/whatsapp/status', { headers }); assert.equal(gateway.status, 200); assert((await gateway.json()).accounts.every(a => a.state === 'unavailable' && a.integration === null));
  const analytics=await fetch(origin+'/api/integrations/whatsapp/analytics',{headers});assert.equal(analytics.status,200);const analyticsData=await analytics.json();assert.equal(analyticsData.available,false);assert(Object.values(analyticsData.metrics).every(v=>v===null));
  assert.equal((await fetch(origin + '/api/tasks', { method: 'POST', headers: { ...headers, origin, 'content-type': 'application/json' }, body: '{}' })).status, 409);
  assert.equal((await fetch(origin + '/api/meetings/send', { method: 'POST', headers: { ...headers, origin, 'content-type': 'application/json' }, body: '{}' })).status, 503);
  const image = await fetch(origin + '/workspace/hb-lake-hero.png', { headers }); assert.equal(image.status, 200); assert(image.headers.get('content-type')?.startsWith('image/'));
  assert.equal(Buffer.from(await image.arrayBuffer()).subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  // Next internal image requests omit cookies. The app uses this protected PNG directly (CSS), not next/image.
  const optimized = await fetch(origin + '/_next/image?url=%2Fworkspace%2Fhb-lake-hero.png&w=640&q=75', { headers }); assert.equal(optimized.status, 400);
  assert.equal((await fetch(origin + '/api/auth/logout', { method: 'POST', headers })).status, 403);
  assert.equal((await fetch(origin + '/api/auth/logout', { method: 'POST', headers: { ...headers, origin } })).status, 200);
  assert.deepEqual(readFileSync('.local-data/preview.json'), previewBefore);
  const report = { checkedAt: new Date().toISOString(), compiledProductionBuild: true, isolatedFixture: true, originalOwnerRolePreservedAndAuthorized: true, analyticsNoContentNoInventedCounts: true, secureHttpOnlyCookie: true, asynchronousParams: true, fourEntries: true, whatsappEntry: true, disabledGatewayWithoutConfig: true, permanentLegacyGuard: true, externalActionGuard: true, directHeroPNG: true, protectedSourceOptimizerRejected: true, logoutOriginGuard: true, previewUnchanged: true, hostedHTTPSVerified: false, actualSMTPUsed: false };
  writeFileSync('.local-data/production-upgrade-smoke.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
} finally {
  if (process.platform === 'win32') {
    // Terminate ONLY the spawned isolated test tree, preserving every other Node process.
    const stop = spawn('taskkill', ['/PID', String(server.pid), '/T', '/F'], { stdio: 'ignore' });
    await new Promise(resolve => stop.once('exit', resolve));
  } else server.kill('SIGTERM');
}
