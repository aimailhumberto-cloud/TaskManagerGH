import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { readWhatsAppStatus } from '../src/lib/whatsappStatus';
async function main() {
const root = await mkdtemp(resolve('.local-data/whatsapp-test-'));
try {
 const token = join(root, 'fixture-token'); await writeFile(token, 'synthetic-only');
 await writeFile(join(root, 'profiles.local.json'), JSON.stringify({personal:{sessionUseApproved:true,tokenFile:token},'bee-smart':{sessionUseApproved:true,tokenFile:token}}));
 await writeFile(join(root,'tunnel-validation-status.json'), JSON.stringify({healthy:true,secret:'do-not-export'}));
 let calls=0;
 const transport = (async (url,options) => { calls++; assert.match(String(url),/^http:\/\/127\.0\.0\.1:301[23]\/health$/); assert.equal(options?.redirect,'error'); return Response.json({profile:String(url).includes('3012')?'personal':'bee-smart',status:'connected',expectedAccountMatches:true,secret:'do-not-export'}); }) as typeof fetch;
 const healthy=await readWhatsAppStatus(root,transport); assert.equal(calls,2); assert(healthy.accounts.every(a=>a.state==='connected')); assert.equal(healthy.tunnel.state,'historical'); assert.equal(healthy.accounts[0].lastActivityAt,null); assert.equal(healthy.permissions.expiresAt,null); assert(!JSON.stringify(healthy).includes('secret')); assert(!JSON.stringify(healthy).includes('synthetic-only'));
 const failed=await readWhatsAppStatus(root,(async()=>{throw Error('secret error')}) as typeof fetch); assert(failed.accounts.every(a=>a.state==='unavailable')); assert(!JSON.stringify(failed).includes('secret error'));
 const wrong=await readWhatsAppStatus(root,(async()=>Response.json({profile:'other',status:'connected',expectedAccountMatches:true})) as typeof fetch); assert(wrong.accounts.every(a=>a.state==='identity_mismatch'));
 const falseMatch=await readWhatsAppStatus(root,(async()=>Response.json({profile:'personal',status:'connected',expectedAccountMatches:false})) as typeof fetch); assert(falseMatch.accounts.every(a=>a.state==='identity_mismatch'));
 assert((await readWhatsAppStatus()).accounts.every(a=>a.state==='unavailable'));
 console.log('PASS WhatsApp isolated contract: health only, identity, failures, whitelist, unknown activity/permissions, historical tunnel');
} finally { await rm(root,{recursive:true,force:true}); }

}
main().catch(error => { console.error(error); process.exitCode = 1; });

