import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {pbkdf2Sync} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';
import {SupabaseOriginalAccounts,workDataOnly} from '../src/services/originalAccounts';
import {SupabaseWorkspaceStore,type WorkspaceRpcClient} from '../src/services/supabaseWorkspaceStore';
import {workspaceDTO} from '../src/lib/publicWorkspace';

async function main(){
 for(const key of Object.keys(process.env))if(/SUPABASE|SMTP|API_KEY|GOOGLE|WHATSAPP|SERVICE_ROLE/.test(key))delete process.env[key];
 const pg=new PGlite();
 try{
  await pg.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE TABLE users(id text PRIMARY KEY,person_id text,email text,is_active boolean,password_hash text,salt text); CREATE TABLE smtp_config(id text PRIMARY KEY,auth_user text,auth_pass text);');
  const hash=pbkdf2Sync('synthetic-only','synthetic-salt',1000,64,'sha512').toString('hex');
  await pg.query('INSERT INTO users VALUES($1,$2,$3,true,$4,$5)',['usr-5ry71br','p1wq05qf','owner@synthetic.test',hash,'synthetic-salt']);
  await pg.query('INSERT INTO smtp_config VALUES($1,$2,$3)',['original-smtp','synthetic-smtp-user','synthetic-smtp-only']);
  const original=JSON.stringify((await pg.query('SELECT * FROM users')).rows)+(JSON.stringify((await pg.query('SELECT * FROM smtp_config')).rows));
  await pg.exec(await readFile('migrations/001_workspace_snapshot.sql','utf8'));
  await pg.exec(await readFile('migrations/002_workspace_work_data_only.sql','utf8'));
  const selections:string[]=[];
  const client:any={from(table:string){assert.equal(table,'users');return {select(columns:string){selections.push(columns);assert(['id,person_id,email,is_active','id,person_id,email,is_active,password_hash,salt'].includes(columns));return {async order(field:string){assert.equal(field,'id');return {data:(await pg.query('SELECT '+columns+' FROM users ORDER BY id')).rows,error:null};},eq(field:string,value:string){assert.equal(field,'id');return {async maybeSingle(){return {data:(await pg.query('SELECT '+columns+' FROM users WHERE id=$1',[value])).rows[0]||null,error:null};}};}};}};}};
  const accounts=new SupabaseOriginalAccounts(client);
  const profiles=await accounts.profiles();assert.equal(profiles.length,1);assert.equal(profiles[0].passwordHash,'');assert.equal(profiles[0].salt,'');assert(!selections.some(s=>s.includes('password_hash')));
  assert.equal(await accounts.authenticate('owner@synthetic.test','wrong'),null);assert.equal((await accounts.authenticate('OWNER@synthetic.test','synthetic-only'))?.id,profiles[0].id);assert.equal(await accounts.authenticate('missing@synthetic.test','synthetic-only'),null);
  const work:any={companies:[{id:'synthetic-company',name:'Synthetic'}],people:[{id:'p1wq05qf',name:'Synthetic HB',role:'Owner',avatar:''}],tasks:[],templates:[],agentQueue:[],projects:[],reminders:[{id:'synthetic-existing-reminder',state:'ExternalLinked',externalId:'synthetic-original-automation',taskIds:[]}],automations:[],users:[{id:'forged',passwordHash:'must-never-persist',salt:'must-never-persist'}],smtpConfig:{pass:'must-never-persist'},aiConfig:{apiKey:'must-never-persist'}};
  await pg.query('INSERT INTO tm_workspace_v1(singleton,revision,document) VALUES(true,1,$1::jsonb)',[JSON.stringify(workDataOnly(work))]);
  const rpc:WorkspaceRpcClient={async rpc(name,args={}){try{const query=name==='tm_workspace_read_v1'?'SELECT tm_workspace_read_v1() AS result':'SELECT tm_workspace_commit_v1($1,$2::jsonb) AS result';const params=name==='tm_workspace_read_v1'?[]:[args.p_expected_revision,JSON.stringify(args.p_document)];return {data:(await pg.query<{result:any}>(query,params)).rows[0].result,error:null};}catch{return {data:null,error:{code:'synthetic-error'}};}}};
  const remote=new SupabaseWorkspaceStore(rpc,accounts);const {DBService}=await import('../src/services/dbService');const db=new DBService(remote,accounts);
  const initial=await db.readData();assert.equal(initial.users[0].id,'usr-5ry71br');assert.equal(initial.users[0].passwordHash,'');assert.equal((await db.authenticateUser('owner@synthetic.test','synthetic-only'))?.id,'usr-5ry71br');
  await db.transaction(data=>{data.tasks.push({id:'synthetic-task',title:'Persisted work',companyId:'synthetic-company',assigneeId:'p1wq05qf',ownerId:'p1wq05qf',type:'One-shot',description:'',status:'Pending',priority:'Medium',origin:'Manual',dueDate:'',workDate:'2026-10-11',steps:[],attachments:[],activityLog:[],passwordHash:'nested-secret'} as any);data.users[0].passwordHash='injected';data.smtpConfig.pass='injected';});
  const stored=(await pg.query<{document:any}>('SELECT document FROM tm_workspace_v1')).rows[0].document;assert.equal(stored.tasks.length,1);assert.equal(stored.users,undefined);assert.equal(stored.smtpConfig,undefined);assert.equal(stored.aiConfig,undefined);assert.equal(stored.tasks[0].passwordHash,undefined);assert.equal(stored.reminders[0].externalId,'synthetic-original-automation');
  const history=(await pg.query<{document:any}>('SELECT document FROM tm_workspace_history_v1')).rows;for(const row of history)assert(!JSON.stringify(row.document).includes('must-never-persist'));
  assert.equal(JSON.stringify((await pg.query('SELECT * FROM users')).rows)+JSON.stringify((await pg.query('SELECT * FROM smtp_config')).rows),original);
  await assert.rejects(db.createUser({personId:'p1wq05qf',email:'new@synthetic.test',isActive:true,passwordPlain:'synthetic'}),/originales/);await assert.rejects(db.updateUser('usr-5ry71br',{passwordPlain:'synthetic'}),/originales/);await assert.rejects(db.deleteUser('usr-5ry71br'),/originales/);await assert.rejects(db.updateSMTPConfig({host:'',port:587,secure:false,user:'',pass:''}),/original/);
  await pg.exec("UPDATE users SET is_active=false WHERE id='usr-5ry71br'");assert.equal(await db.authenticateUser('owner@synthetic.test','synthetic-only'),null);
  const revoked=await db.readData();assert.throws(()=>workspaceDTO(revoked,{userId:'usr-5ry71br',personId:'p1wq05qf',email:'owner@synthetic.test',role:'Owner',createdAt:new Date().toISOString()}),/revocada/);
  console.log(JSON.stringify({syntheticOnly:true,originalLoginVerified:true,metadataQueriesExcludeCredentials:true,workspaceAndHistoryExcludeCredentials:true,originalAccountAndSMTPRowsUnchanged:true,accountAndConfigMutationsDenied:true,existingReminderPreserved:true,revocationUsesOriginalSource:true,productionTouched:false}));
 }finally{await pg.close();}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
