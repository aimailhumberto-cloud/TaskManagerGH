import { chromium } from '@playwright/test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const before=readFileSync('.local-data/preview.json'); const origin='http://127.0.0.1:3011';
const browser=await chromium.launch({headless:true});
try {
 const context=await browser.newContext(); assert.equal((await context.request.get(origin+'/api/integrations/whatsapp/status')).status(),401);
 assert((await context.request.post(origin+'/api/auth/login',{data:{email:'humberto@local.test',password:'preview-local-only'}})).ok());
 const page=await context.newPage(); const errors=[]; page.on('pageerror',error=>errors.push(error.message));
 const status=await context.request.get(origin+'/api/integrations/whatsapp/status');assert.equal(status.status(),200);assert.match(status.headers()['cache-control'],/no-store/); const live=await status.json();assert.equal(live.accounts.length,2);assert(live.accounts.every(a=>['connected','disconnected','unavailable','identity_mismatch'].includes(a.state)));assert.equal(live.permissions.expiresAt,null);assert(!JSON.stringify(live).match(/Bearer|tokenFile|phone|sender|messageId/));
 mkdirSync('.local-data/whatsapp-qa',{recursive:true});
 for (const width of [1440,390,320]) { await page.setViewportSize({width,height:960});await page.goto(origin+'/whatsapp'); const panel=page.getByRole('region',{name:'Estado de WhatsApp'});await panel.getByRole('status').filter({hasText:'Consultado'}).waitFor();assert.equal(await panel.getByRole('article',{name:'WhatsApp Personal'}).count(),1);assert.equal(await panel.getByRole('article',{name:'WhatsApp BEE SMART'}).count(),1);assert((await panel.innerText()).includes('Estado actual: dato no disponible'));assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth));await page.screenshot({path:'.local-data/whatsapp-qa/'+width+'.png',fullPage:true}); }
 await page.route('**/api/integrations/whatsapp/status',route=>route.fulfill({status:503,body:'{}'}));await page.getByRole('button',{name:'Actualizar estado'}).click();await page.getByRole('alert').filter({hasText:'No se pudo comprobar el estado.'}).waitFor(); assert(!(await page.getByRole('region',{name:'Estado de WhatsApp'}).innerText()).includes('Conectada · verificada'));
 await page.unroute('**/api/integrations/whatsapp/status');await page.getByRole('button',{name:'Actualizar estado'}).click();await page.getByRole('button',{name:'Actualizar estado'}).waitFor();
 for (const path of ['/','/empresas','/agenda','/buscar']) {await page.goto(origin+path);await page.locator('.tm-workspace').waitFor();}
 assert.deepEqual(readFileSync('.local-data/preview.json'),before);assert.deepEqual(errors,[]);
 const report={checkedAt:new Date().toISOString(),live,viewports:[1440,390,320],unauthenticated401:true,readOnlyNoStore:true,errorRetry:true,existingEntries:true,previewUnchanged:true,pageErrors:errors};writeFileSync('.local-data/whatsapp-qa/report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{await browser.close();}

