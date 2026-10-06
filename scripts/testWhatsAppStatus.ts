import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { readWhatsAppStatus, sanitizeIntegration } from '../src/lib/whatsappStatus';
async function main() {
const root = await mkdtemp(resolve('.local-data/whatsapp-test-'));
try {
 const token = join(root, 'fixture-token'); await writeFile(token, 'synthetic-only');
 await writeFile(join(root, 'profiles.local.json'), JSON.stringify({personal:{sessionUseApproved:true,tokenFile:token},'bee-smart':{sessionUseApproved:true,tokenFile:token}}));
 await writeFile(join(root,'tunnel-validation-status.json'), JSON.stringify({healthy:true,secret:'do-not-export'}));
 let calls=0;
 const transport = (async (url,options) => { calls++; assert.match(String(url),/^http:\/\/127\.0\.0\.1:301[23]\/health$/); assert.equal(options?.redirect,'error'); return Response.json({profile:String(url).includes('3012')?'personal':'bee-smart',status:'connected',expectedAccountMatches:true,secret:'do-not-export'}); }) as typeof fetch;
 const healthy=await readWhatsAppStatus(root,transport); assert.equal(calls,2); assert(healthy.accounts.every(a=>a.state==='connected')); assert.equal(healthy.accounts[0].integration,null); assert(!JSON.stringify(healthy).includes('secret')); assert(!JSON.stringify(healthy).includes('synthetic-only'));
 const failed=await readWhatsAppStatus(root,(async()=>{throw Error('secret error')}) as typeof fetch); assert(failed.accounts.every(a=>a.state==='unavailable')); assert(!JSON.stringify(failed).includes('secret error'));
 const wrong=await readWhatsAppStatus(root,(async()=>Response.json({profile:'other',status:'connected',expectedAccountMatches:true})) as typeof fetch); assert(wrong.accounts.every(a=>a.state==='identity_mismatch'));
 const falseMatch=await readWhatsAppStatus(root,(async()=>Response.json({profile:'personal',status:'connected',expectedAccountMatches:false})) as typeof fetch); assert(falseMatch.accounts.every(a=>a.state==='identity_mismatch'));
 assert((await readWhatsAppStatus()).accounts.every(a=>a.state==='unavailable'));
 const now=Date.now(); const stamp=new Date(now).toISOString();
 const raw={schemaVersion:1,checkedAt:stamp,available:true,activity:{available:true,lastIncomingAt:stamp,lastOutgoingAcceptedAt:stamp},permissions:{events:{enabled:true,expiresAt:stamp,subscriptionExpiresAt:stamp,autoRenewEnabled:true,activeSubscriptions:1},send:{mode:'exact_single_order_approval',automaticReplies:false}},tunnel:{state:'polling_verified',checkedAt:stamp,lastSuccessfulPollAt:stamp,pollEvidenceAt:stamp,evidenceFresh:true,pollEvidenceFresh:true,remotePollVerified:true}};
 assert.equal(sanitizeIntegration(raw,now)?.tunnel.state,'polling_verified'); assert.equal(sanitizeIntegration(raw,now+120001),null); assert.equal(sanitizeIntegration({...raw,tunnel:{...raw.tunnel,lastSuccessfulPollAt:new Date(now-120001).toISOString()}},now)?.tunnel.state,'unknown'); assert.equal(sanitizeIntegration({...raw,schemaVersion:2},now),null); assert.equal(sanitizeIntegration({...raw,available:false},now),null);
 console.log('PASS WhatsApp isolated contract: health only, identity, failures, whitelist, unknown activity/permissions, historical tunnel');
} finally { await rm(root,{recursive:true,force:true}); }

}
main().catch(error => { console.error(error); process.exitCode = 1; });
