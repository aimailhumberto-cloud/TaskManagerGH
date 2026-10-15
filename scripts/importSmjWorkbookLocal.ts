import {existsSync,readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {importSmjReferences} from '../src/lib/smjTracking';
import {createBackup} from '../src/lib/localBackup';
async function main(){
 if(['.env','.env.local','.env.production','.env.production.local'].some(existsSync))throw Error('Local import refuses service environment files');
 for(const key of Object.keys(process.env))if(/SUPABASE|SMTP|API_KEY|SERVICE_ROLE|GOOGLE|WHATSAPP/.test(key))delete process.env[key];
 const file=resolve('.local-data/preview.json');process.env.DATABASE_PATH=file;process.env.TASKMANAGER_LOCAL_ONLY='1';process.env.TASKMANAGER_EXTERNAL_ACTIONS_ENABLED='0';
 const workbook=readFileSync('.local-data/smj-source/SMJ_HB_Targets_and_Contract_v2.xlsx');const expected='e71b43534aa380e9f239250e6ab76ffe986df574a0df69677dfd5e635de75795';assert.equal(workbook.length,130035);assert.equal(createHash('sha256').update(workbook).digest('hex'),expected);
 const selected=JSON.parse(readFileSync('.local-data/smj-selected-references.json','utf8'));assert.equal(selected.source.sha256,expected);assert.equal(selected.rows.length,276);
 const before=JSON.parse(readFileSync(file,'utf8'));assert.equal(before.tasks.length,14);assert.equal(before.companies.length,8);assert.equal(before.projects.length,1);assert.equal(before.reminders.length,1);
 const owners=[...new Set(before.tasks.filter((t:any)=>t.companyId==='business-sm-jaleel').map((t:any)=>t.ownerId))];assert.equal(owners.length,1);const owner=owners[0] as string;assert(before.people.some((p:any)=>p.id===owner));
 const backup=await createBackup(file);const {dbService}=await import('../src/services/dbService');const protectedKeys=Object.keys(before).filter(k=>k!=='smjTracking');
 const apply=()=>dbService.transaction(data=>{for(const key of protectedKeys)assert.deepEqual((data as any)[key],before[key]);data.smjTracking=importSmjReferences(data.smjTracking,owner,selected.source,selected.rows);return {revision:data.smjTracking.revision,references:data.smjTracking.references.length,records:data.smjTracking.records.length};});
 const first=await apply(),afterFirst=JSON.parse(readFileSync(file,'utf8'));const second=await apply(),afterSecond=JSON.parse(readFileSync(file,'utf8'));assert.deepEqual(second,first);assert.deepEqual(afterFirst.smjTracking,afterSecond.smjTracking);for(const key of protectedKeys)assert.deepEqual(afterSecond[key],before[key]);assert.equal(createHash('sha256').update(readFileSync('.local-data/smj-source/SMJ_HB_Targets_and_Contract_v2.xlsx')).digest('hex'),expected);
 const report={actualVerifiedWorkbook:true,source:selected.source,backup,localDatabase:file,first,second,idempotent:true,protectedCollectionsUnchanged:true,counts:{tasks:14,companies:8,projects:1,reminders:1,automations:afterSecond.automations.length,accounts:afterSecond.users.length},controls:selected.controls,recordsCreatedByImport:0,tasksOrRecurrencesCreated:0,productionTouched:false};writeFileSync('.local-data/smj-real-import-report.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}
main().catch(error=>{console.error(error);process.exitCode=1;});
