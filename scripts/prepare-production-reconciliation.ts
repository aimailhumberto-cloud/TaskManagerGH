import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname,relative,isAbsolute} from 'node:path';
import {createHash} from 'node:crypto';
import {prepareLegacyImport} from '../src/lib/legacySupabaseMigration';
import {validateDatabase} from '../src/lib/localBackup';

// Offline candidate report only. Never writes either database or combines identities.
async function main(){
 const [source,sha256,local,destination]=process.argv.slice(2);
 if(!source||!sha256||!local||!destination)throw Error('Arguments required');
 const privateRoot=resolve('.local-data'),output=resolve(destination),within=relative(privateRoot,output);
 if(!within||within.startsWith('..')||isAbsolute(within)||[source,local].some(p=>resolve(p)===output))throw Error('Private new destination required');
 const originalBytes=await readFile(source),localBytes=await readFile(local);
 const bundle=prepareLegacyImport(originalBytes,sha256),preview=JSON.parse(localBytes.toString('utf8'));
 validateDatabase(preview);
 const normalize=(v:unknown)=>typeof v==='string'?v.normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('es'):'';
 const original=bundle.data;
 const companyCandidates=preview.companies.map(c=>({localId:c.id,candidates:original.companies.filter(p=>p.id===c.id||normalize(p.name)===normalize(c.name)).map(p=>({originalId:p.id,reason:p.id===c.id?'same-id-requires-row-review':'same-name-not-identity-proof'}))}));
 const taskCandidates=preview.tasks.map(t=>({localId:t.id,demoByTitle:/\bDEMO\b/i.test(t.title||''),validationStatus:t.validationStatus||null,companyId:t.companyId,ownerId:t.ownerId||null,candidates:original.tasks.filter(p=>p.id===t.id||!!t.sourceUrl&&t.sourceUrl===p.sourceUrl||normalize(p.title)===normalize(t.title)).map(p=>({originalId:p.id,reason:p.id===t.id?'same-id-requires-row-review':t.sourceUrl&&t.sourceUrl===p.sourceUrl?'same-source-review-scope':'same-title-not-duplicate-proof'}))}));
 const report={format:'taskmanager-reconciliation-review-v1',at:new Date().toISOString(),project:'sitaivletjymybozpsdn',sourceSha256:sha256,localSha256:createHash('sha256').update(localBytes).digest('hex'),sourceRowCounts:bundle.sourceRowCounts,localCounts:{tasks:preview.tasks.length,companies:preview.companies.length},originalPreserved:true,databaseChanged:false,readyForProduction:false,automaticMerges:0,usersToImportFromPreview:0,companyCandidates,taskCandidates,originalAudit:bundle.audit,requires:['Verified schema and isolated restore of actual export','Verified attachment inventory and restore','Explicit mapping from local owner to original active app user/person','Review all company/task candidates; names and source URLs alone are not merge permission','Exclude demo records and local credentials; preserve all original IDs/history/password hashes','Explicit treatment of local approved vs unverified records and calendar reminders','Reconcile counts again at frozen cutover']};
 await mkdir(dirname(output),{recursive:true});await writeFile(output,JSON.stringify(report,null,2),{flag:'wx',mode:0o600});
 console.log(JSON.stringify({prepared:true,sourceRowCounts:report.sourceRowCounts,localCounts:report.localCounts,companyCandidates:companyCandidates.filter(c=>c.candidates.length).length,taskCandidates:taskCandidates.filter(c=>c.candidates.length).length,demoByTitle:taskCandidates.filter(t=>t.demoByTitle).length,automaticMerges:0,databaseChanged:false,readyForProduction:false}));
}
main().catch(()=>{console.error('Conciliación rechazada: verifica export privado completo, hash independiente, base local y destino privado nuevo. No se cambió ninguna base.');process.exitCode=1;});
