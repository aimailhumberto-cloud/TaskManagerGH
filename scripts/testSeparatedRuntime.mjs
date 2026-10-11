import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {createHmac,pbkdf2Sync,randomBytes} from 'node:crypto';
import {PGlite} from '@electric-sql/pglite';

const origin='http://127.0.0.1:47919',backend='http://127.0.0.1:47920';
const secret=randomBytes(48).toString('hex'),password='synthetic-login-only',salt='synthetic-salt';
const original=[{id:'usr-5ry71br',person_id:'p1wq05qf',email:'owner@synthetic.test',is_active:true,password_hash:pbkdf2Sync(password,salt,1000,64,'sha512').toString('hex'),salt}];
const originalBytes=JSON.stringify(original),actualPreview=readFileSync('.local-data/preview.json');
const work={companies:[{id:'synthetic-business',name:'Synthetic business'}],people:[{id:'p1wq05qf',name:'Synthetic owner',role:'Owner',avatar:''}],tasks:[],templates:[],agentQueue:[],projects:[],decisions:[],dayPlans:[],appliedOperations:[],reminders:[{id:'synthetic-existing-reminder',ownerId:'p1wq05qf',title:'Synthetic eTA ESTA passport',state:'ExternalLinked',externalId:'synthetic-existing-external',taskIds:['synthetic-0','synthetic-1','synthetic-2']}],automations:[],legacyAdministration:{version:1,userId:'usr-5ry71br',personId:'p1wq05qf',taskIds:Array.from({length:74},(_,i)=>'synthetic-'+i),sourceSha256:'a'.repeat(64),approvedAt:'2026-10-09T12:38:00Z',approvalReference:'Synthetic policy only'}};
for(const id of work.legacyAdministration.taskIds)work.tasks.push({id,title:'Synthetic legacy '+id,description:'',companyId:'synthetic-business',assigneeId:'p1wq05qf',assigneeIds:['p1wq05qf'],type:'One-shot',status:'Pending',priority:'Medium',origin:'Manual',dueDate:'',workDate:'2026-10-11',steps:[],attachments:[],activityLog:[],revision:0});
const pg=new PGlite();let child;const calls=[];
const api=createServer(async(req,res)=>{try{
 const url=new URL(req.url,backend);res.setHeader('content-type','application/json');
 if(url.pathname==='/rest/v1/users'){
  const columns=url.searchParams.get('select');assert(['id,person_id,email,is_active','id,person_id,email,is_active,password_hash,salt'].includes(columns));
  const filter=url.searchParams.get('id');if(columns.includes('password_hash'))assert.equal(filter,'eq.usr-5ry71br');calls.push({columns,narrow:!!filter});
  const rows=original.filter(u=>!filter||'eq.'+u.id===filter).map(u=>Object.fromEntries(columns.split(',').map(k=>[k,u[k]])));
  res.end(JSON.stringify((req.headers.accept||'').includes('vnd.pgrst.object')?rows[0]||null:rows));return;
 }
 let body='';for await(const chunk of req)body+=chunk;const args=JSON.parse(body||'{}');
 if(url.pathname==='/rest/v1/rpc/tm_workspace_read_v1'){res.end(JSON.stringify((await pg.query('SELECT tm_workspace_read_v1() AS value')).rows[0].value));return;}
 if(url.pathname==='/rest/v1/rpc/tm_workspace_commit_v1'){
  assert(!['users','smtpConfig','aiConfig'].some(k=>Object.hasOwn(args.p_document,k)));assert(!/"(?:passwordHash|password_hash|salt|auth_pass|auth_user)"\s*:/.test(JSON.stringify(args.p_document)));
  res.end(JSON.stringify((await pg.query('SELECT tm_workspace_commit_v1($1,$2::jsonb) AS value',[args.p_expected_revision,JSON.stringify(args.p_document)])).rows[0].value));return;
 }
 res.statusCode=404;res.end('{}');
 }catch{res.statusCode=500;res.end(JSON.stringify({error:'Synthetic backend rejected request'}));}});
try{
 await pg.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;');await pg.exec(readFileSync('migrations/001_workspace_snapshot.sql','utf8'));await pg.exec(readFileSync('migrations/002_workspace_work_data_only.sql','utf8'));await pg.query('INSERT INTO tm_workspace_v1(singleton,revision,document) VALUES(true,1,$1::jsonb)',[JSON.stringify(work)]);
 await new Promise(resolve=>api.listen(47920,'127.0.0.1',resolve));
 const env={...process.env,SESSION_SECRET:secret,TASKMANAGER_LOCAL_ONLY:'0',TASKMANAGER_EXTERNAL_ACTIONS_ENABLED:'0',NODE_ENV:'production',NEXT_TELEMETRY_DISABLED:'1'};for(const key of Object.keys(env))if(/SUPABASE|SMTP|API_KEY|SERVICE_ROLE|GOOGLE|WHATSAPP/.test(key))delete env[key];env.SUPABASE_URL=backend;env.SUPABASE_SERVICE_ROLE_KEY='synthetic-not-a-real-service-key';
 child=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-H','127.0.0.1','-p','47919'],{env,stdio:'ignore'});
 let ready=false;for(let n=0;n<100;n++){if(child.exitCode!==null)throw Error('Synthetic app stopped');try{if((await fetch(origin+'/login')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,200));}assert(ready);
 const login=async value=>fetch(origin+'/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'owner@synthetic.test',password:value})});assert.equal((await login('wrong')).status,401);const signedIn=await login(password);assert.equal(signedIn.status,200);const response=await signedIn.text();assert(!response.includes('password_hash'));assert(!response.includes(salt));
 const cookie=signedIn.headers.get('set-cookie').split(';')[0],token=cookie.slice('hermes_session='.length);const headers={cookie,origin,'content-type':'application/json','x-csrf-token':createHmac('sha256',secret).update('taskmanager-csrf:'+token).digest('hex')};
 const view=await fetch(origin+'/api/workspace?day=2026-10-11',{headers});assert.equal(view.status,200);const current=await view.json();assert.equal(current.tasks.length,74);assert.equal(current.managedLegacyTaskIds.length,74);
 const operation={action:'updateTask',id:'synthetic-0',requestId:'synthetic-runtime-edit',expectedRevision:0,reason:'Synthetic edit',fields:{title:'Synthetic runtime saved',status:'Completed'}};
 const command=body=>fetch(origin+'/api/workspace',{method:'POST',headers,body:JSON.stringify(body)});assert.equal((await command(operation)).status,200);assert.equal((await command(operation)).status,200);assert.equal((await command({...operation,requestId:'synthetic-conflict'})).status,409);
 for(const path of ['/','/agenda','/empresas','/buscar','/api/reminders']){const r=await fetch(origin+path,{headers});assert.equal(r.status,200,path);const text=await r.text();assert(!text.includes(original[0].password_hash));assert(!text.includes('password_hash'));assert(!text.includes(salt));}
 const persisted=(await pg.query('SELECT document FROM tm_workspace_v1')).rows[0].document;assert.equal(persisted.tasks[0].title,'Synthetic runtime saved');assert.equal(persisted.tasks[0].revision,1);assert.equal(persisted.tasks[0].ownerId,undefined);assert.equal(persisted.reminders.length,1);assert.equal(persisted.reminders[0].externalId,'synthetic-existing-external');assert.equal(persisted.users,undefined);assert.equal(persisted.smtpConfig,undefined);assert.equal(JSON.stringify(original),originalBytes);
 original[0].is_active=false;assert.equal((await fetch(origin+'/api/workspace',{headers})).status,401);assert.equal((await login(password)).status,401);assert.deepEqual(readFileSync('.local-data/preview.json'),actualPreview);
 console.log(JSON.stringify({syntheticOnly:true,compiledRuntime:true,originalAccountLogin:true,badPasswordDenied:true,liveOriginalRevocation:true,taskPersistence:true,idempotencyAndConflict:true,agendaAndWorkspacePages:true,existingReminderNotDuplicated:true,workspaceAndHistoryWorkOnly:true,originalRowsUnchangedBeforeRevocationTest:true,actualPreviewUnchanged:true,productionTouched:false}));
}finally{if(child)child.kill();await new Promise(resolve=>api.close(resolve));await pg.close();}
