import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {prepareLegacyImport} from '../src/lib/legacySupabaseMigration';
const tables=['companies','people','email_templates','smtp_config','tasks','users','agent_queue'];
async function main(){
 const pg=new PGlite();try{
 await pg.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;');
 await pg.exec('ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;');
 await pg.exec(await readFile('scripts/fixtures/original-schema-metadata.sql','utf8'));
 await pg.exec(`INSERT INTO companies VALUES ('company','Fictitious'); INSERT INTO people VALUES ('person','Fictitious owner','Admin','','company'); INSERT INTO users(id,person_id,email,password_hash,salt) VALUES('user','person','fixture@isolated.test','synthetic-hash','synthetic-salt'); INSERT INTO smtp_config VALUES('default','smtp.invalid',587,false,'synthetic-user','synthetic-secret'); INSERT INTO tasks(id,title,description,type,company_id,assignee_id,status,priority,origin,due_date) VALUES('task','Synthetic task','','OneOff','company','person','Pending','Medium','Manual','2026-10-01 15:00:00+00'); INSERT INTO agent_queue(id,task_id,command,status) VALUES('queue','task','synthetic-not-executed','Pending'); INSERT INTO email_templates VALUES('template','Synthetic','Synthetic','Synthetic');`);
 const snapshot=async()=>Object.fromEntries(await Promise.all(tables.map(async t=>[t,(await pg.query(`SELECT * FROM public.${t} ORDER BY id`)).rows])));
 const before=await snapshot();const workTables={...before,smtp_config:[],users:before.users.map((u:any)=>({id:u.id,person_id:u.person_id,email:u.email,is_active:u.is_active}))};const source=JSON.parse(JSON.stringify({format:'taskmanager-work-export-v2',tables:workTables,rowCounts:Object.fromEntries(tables.map(t=>[t,workTables[t].length]))}));
 const bytes=Buffer.from(JSON.stringify(source)),bundle=prepareLegacyImport(bytes,createHash('sha256').update(bytes).digest('hex'));
 assert.deepEqual(bundle.legacySource,source);assert.equal(bundle.data.users,undefined);assert.equal(bundle.data.smtpConfig,undefined);assert.equal(bundle.data.agentQueue.length,1);assert.equal(bundle.data.tasks[0].ownerId,undefined);assert(bundle.audit.tasksWithoutOwner===1);assert.equal(bundle.readyForProduction,false);
 await pg.exec(await readFile('migrations/001_workspace_snapshot.sql','utf8'));
 await pg.exec(await readFile('migrations/002_workspace_work_data_only.sql','utf8'));
 assert.deepEqual(await snapshot(),before);assert.equal((await pg.query('SELECT * FROM tm_workspace_v1')).rows.length,0);
 // Security-event-trigger behavior does not prevent explicit service-role ACLs.
 await pg.exec('SET ROLE anon');await assert.rejects(pg.query('SELECT tm_workspace_read_v1()'),/permission denied/);await pg.exec('RESET ROLE; SET ROLE service_role');
 assert.equal((await pg.query<{value:unknown}>('SELECT tm_workspace_read_v1() AS value')).rows[0].value,null);
 await pg.exec('RESET ROLE');assert.deepEqual(await snapshot(),before);
 for(const table of ['tm_workspace_v1','tm_workspace_history_v1']){
   const rights=(await pg.query<{privilege_type:string}>('SELECT privilege_type FROM information_schema.role_table_grants WHERE grantee=$1 AND table_name=$2 ORDER BY privilege_type',['service_role',table])).rows.map(r=>r.privilege_type);
   assert.deepEqual(rights,table==='tm_workspace_v1'?['INSERT','SELECT','UPDATE']:['INSERT','SELECT']);
 }
 console.log('PASS metadata-derived isolated schema: seven tables/FKs/RLS/event-trigger behavior, additive migration preserves all synthetic rows, SMTP/accounts remain in original tables; queue migrated, owner not inferred. NOT real backup/restore or hosted validation.');
 }finally{await pg.close();}
}
main().catch(()=>{console.error('Metadata compatibility test failed; no production connection or changes.');process.exitCode=1;});
