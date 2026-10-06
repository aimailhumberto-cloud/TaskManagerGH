import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {randomBytes,pbkdf2Sync,createHmac,createHash} from 'node:crypto';
import {chromium} from '@playwright/test';

// Five synthetic accounts with the verified original roles. No production records or credentials.
const origin='http://127.0.0.1:47915',root=resolve('.local-data/privacy-qa');mkdirSync(root,{recursive:true});
const actual=readFileSync('.local-data/preview.json');
const roles=['Owner','Gerente','Administrativo','Gerente','Coordinadora Operativa'];
const secret=randomBytes(48).toString('hex'),salt='synthetic-privacy-only',password='isolated-privacy-only';
const data={companies:[],people:[],users:[],tasks:[],projects:[],templates:[],agentQueue:[],smtpConfig:{host:'PRIVATE_SMTP_SENTINEL',port:587,user:'PRIVATE_SMTP_USER',pass:'PRIVATE_SMTP_PASS'},aiConfig:{apiKey:'PRIVATE_APIKEY_SENTINEL'},reminders:[]};
for(let i=0;i<5;i++){
 data.companies.push({id:'c'+i,name:'Business '+i,passwordHash:'PRIVATE_NESTED_SENTINEL'});
 data.people.push({id:'p'+i,name:'Person '+i,role:roles[i],avatar:'',companyId:'c'+i,salt:'PRIVATE_NESTED_SENTINEL'});
 data.users.push({id:'u'+i,personId:'p'+i,email:`profile${i}@privacy.test`,passwordHash:pbkdf2Sync(password,salt,1000,64,'sha512').toString('hex'),salt,isActive:true});
 data.tasks.push({id:'t'+i,title:'PRIVATE_TASK_'+i,description:'Only assigned profile '+i,type:'One-shot',companyId:'c'+i,ownerId:'p'+i,assigneeId:'p'+i,assigneeIds:['p'+i],status:'Pending',priority:'Medium',origin:'Manual',dueDate:'',workDate:'2026-10-06',steps:[],attachments:[{id:'a'+i,filename:'attachment'+i+'.txt',filepath:'/data/attachments/attachment'+i+'.txt',uploadedAt:new Date().toISOString(),passwordHash:'PRIVATE_NESTED_SENTINEL'}],activityLog:[{timestamp:new Date().toISOString(),user:'Synthetic',action:'Created',type:'User',snapshot:{id:'t'+i,title:'PRIVATE_TASK_'+i,smtpConfig:{pass:'PRIVATE_SMTP_PASS'},passwordHash:'PRIVATE_NESTED_SENTINEL'}}],comments:[{id:'comment'+i,personId:'p'+i,user:'Person '+i,text:'Comment',timestamp:new Date().toISOString(),salt:'PRIVATE_NESTED_SENTINEL'}],projectId:'project'+i,revision:1,passwordHash:'PRIVATE_NESTED_SENTINEL'});
 data.projects.push({id:'project'+i,companyId:'c'+i,title:'PRIVATE_PROJECT_'+i,objective:'Objective',scope:'Scope',ownerId:'p'+i,acceptancePersonId:'p'+i,state:'Active',revision:1,stages:[],deliverables:[],milestones:[],evidence:[],history:[],smtpConfig:{pass:'PRIVATE_SMTP_PASS'}});
 writeFileSync(resolve(root,'attachment'+i+'.txt'),'PRIVATE_ATTACHMENT_'+i);
}
data.tasks.push({...data.tasks[0],id:'ambiguous',title:'PRIVATE_AMBIGUOUS',ownerId:undefined,assigneeId:'',assigneeIds:[],projectId:'ambiguous-project',attachments:[]});
data.projects.push({...data.projects[0],id:'ambiguous-project',title:'PRIVATE_AMBIGUOUS_PROJECT',ownerId:'missing-person'});
writeFileSync(resolve(root,'unlinked.txt'),'UNLINKED_PRIVATE');
const database=resolve(root,'database.json');writeFileSync(database,JSON.stringify(data));const before=readFileSync(database);
const env={...process.env,DATABASE_PATH:database,SESSION_SECRET:secret,TASKMANAGER_LOCAL_ONLY:'0',TASKMANAGER_EXTERNAL_ACTIONS_ENABLED:'0',TASKMANAGER_ATTACHMENTS_DIRECTORY:root,NEXT_TELEMETRY_DISABLED:'1',NODE_ENV:'production'};
for(const k of Object.keys(env))if(/SUPABASE|SMTP|TELEGRAM|API_KEY|SERVICE_ROLE|OPENAI|ANTHROPIC|WHATSAPP|GOOGLE/i.test(k))delete env[k];
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-H','127.0.0.1','-p','47915'],{env,stdio:'ignore'});
let browser;const checks=[];
const sensitive=['passwordHash','password_hash','salt','"smtpConfig"','"smtp_config"','PRIVATE_SMTP','PRIVATE_APIKEY','PRIVATE_NESTED'];
function clean(text){for(const marker of sensitive)assert(!text.includes(marker),'Sensitive field leaked: '+marker);}
function token(i,role=roles[i]){const payload=Buffer.from(JSON.stringify({userId:'u'+i,personId:'p'+i,email:`profile${i}@privacy.test`,role,createdAt:new Date().toISOString()})).toString('base64url');return payload+'.'+createHmac('sha256',secret).update(payload).digest('base64url');}
function headers(i,role){const session=token(i,role);return {cookie:'hermes_session='+session,origin,'content-type':'application/json','x-csrf-token':createHmac('sha256',secret).update('taskmanager-csrf:'+session).digest('hex')};}
async function request(path,i,options={}){return fetch(origin+path,{...options,headers:{...headers(i),...options.headers},redirect:'manual'});}
try{
 let ready=false;for(let n=0;n<100;n++){if(server.exitCode!==null)throw Error('Isolated server exited');try{if((await fetch(origin+'/login')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,250));}assert(ready);
 for(let i=0;i<5;i++){
  const login=await fetch(origin+'/api/auth/login',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:`profile${i}@privacy.test`,password})});assert.equal(login.status,200);clean(await login.text());assert(/Secure/i.test(login.headers.get('set-cookie')));
  for(const path of ['/api/workspace','/api/tasks','/api/companies','/api/persons','/api/auth/me','/api/reminders']){
   const response=await request(path,i);assert.equal(response.status,200,path);const body=await response.text();clean(body);
   if(i>0){for(let j=0;j<5;j++)if(j!==i){assert(!body.includes('PRIVATE_TASK_'+j),path+' foreign task');assert(!body.includes('PRIVATE_PROJECT_'+j),path+' foreign project');}assert(!body.includes('PRIVATE_AMBIGUOUS'));}
   if(path==='/api/workspace'){const view=JSON.parse(body);assert.equal(view.tasks.length,i===0?6:1);assert.equal(view.projects.length,i===0?6:1);assert.equal(view.people.length,i===0?6:2);assert.equal(view.tasks.find(t=>t.id==='t'+i).comments[0].personId,'p'+i);}
  }
  for(const path of ['/','/empresas','/agenda','/buscar','/settings']){const response=await request(path,i);assert([200,307].includes(response.status));const body=await response.text();clean(body);if(i>0){for(let j=0;j<5;j++)if(j!==i){assert(!body.includes('PRIVATE_TASK_'+j),path+' SSR task');assert(!body.includes('PRIVATE_PROJECT_'+j),path+' SSR project');}assert(!body.includes('PRIVATE_AMBIGUOUS'));}}
  for(let j=0;j<5;j++){assert.equal((await request('/api/tasks/t'+j,i)).status,i===0||j===i?200:404);const response=await request('/data/attachments/attachment'+j+'.txt',i);assert.equal(response.status,i===0||j===i?200:404);if(response.ok)assert.equal(await response.text(),'PRIVATE_ATTACHMENT_'+j);}
  assert.equal((await request('/data/attachments/unlinked.txt',i)).status,404);
  for(const path of ['/api/settings','/api/users']){const r=await request(path,i);assert.equal(r.status,i===0?200:403);clean(await r.text());}
  for(const path of ['/api/tasks','/api/tasks/t0','/api/companies','/api/persons'])assert.equal((await request(path,i,{method:path.endsWith('t0')?'PUT':'POST',body:'{}'})).status,i===0?409:403);
  assert.equal((await request('/api/settings',i,{method:'POST',body:'{}'})).status,403);
  assert.equal((await request('/api/workspace',i,{method:'POST',body:JSON.stringify({action:'updateTask',id:i===0?'ambiguous':'t'+((i+1)%5),expectedRevision:1,fields:{title:'Unauthorized'},requestId:'private-'+i,reason:'Unauthorized test'})})).status,403);
  const form=new FormData();form.set('taskId',i===0?'ambiguous':'t0');form.set('file',new Blob(['Denied upload']),'denied.txt');assert.equal((await fetch(origin+'/api/attachments',{method:'POST',headers:{cookie:headers(i).cookie,origin},body:form})).status,403);
  if(i>0)assert.equal((await fetch(origin+'/api/users',{headers:headers(i,'Owner')})).status,403);
  checks.push({role:roles[i],taskRead:true,foreignIDsDenied:i>0,SSRScoped:true,downloadsScoped:true,mutationsDenied:true});
 }
 assert.deepEqual(readFileSync(database),before,'Read/denied mutations changed isolated rows');
 const adminEdit=await request('/api/workspace',0,{method:'POST',body:JSON.stringify({action:'updateTask',id:'t1',expectedRevision:1,fields:{title:'Administrative edit verified'},requestId:'admin-capability',reason:'Isolated administrative capability test'})});assert.equal(adminEdit.status,200);const edited=await adminEdit.json();assert.equal(edited.ownerId,'p1');clean(JSON.stringify(edited));writeFileSync(database,before);
 const linked=structuredClone(data);linked.tasks[1].projectId='project0';writeFileSync(database,JSON.stringify(linked));assert(!(await (await request('/api/workspace',1)).json()).projects.some(p=>p.id==='project0'),'Mismatched company must not grant project access');linked.tasks[1].companyId='c0';writeFileSync(database,JSON.stringify(linked));assert((await (await request('/api/workspace',1)).json()).projects.some(p=>p.id==='project0'),'Verified same-company assignment must grant project read');writeFileSync(database,before);

 const revoked=structuredClone(data);revoked.users[1].isActive=false;writeFileSync(database,JSON.stringify(revoked));assert.equal((await request('/api/workspace',1)).status,401);assert.equal((await request('/api/auth/me',1)).status,401);assert.equal((await request('/',1)).status,307);
 revoked.users[1].isActive=true;revoked.users[1].personId='p2';writeFileSync(database,JSON.stringify(revoked));assert.equal((await request('/api/workspace',1)).status,401);assert.equal((await request('/api/auth/me',1)).status,401);writeFileSync(database,before);
 browser=await chromium.launch({headless:true});
 for(const i of [0,1]){const context=await browser.newContext();await context.addCookies([{name:'hermes_session',value:token(i),url:origin,httpOnly:true,secure:true,sameSite:'Lax'}]);const page=await context.newPage();await page.goto(origin,{waitUntil:'domcontentloaded'});await page.waitForLoadState('domcontentloaded');assert(!page.url().includes('/login'));for(const viewport of [{width:1440,height:1000},{width:390,height:844}]){await page.setViewportSize(viewport);for(const path of ['/','/empresas','/agenda','/buscar']){await page.goto(origin+path,{waitUntil:'domcontentloaded'});await page.waitForLoadState('domcontentloaded');const text=await page.content();clean(text);if(i===1)for(let j=0;j<5;j++)if(j!==i)assert(!text.includes('PRIVATE_TASK_'+j));assert(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),'Horizontal overflow');}await page.screenshot({path:resolve(root,`profile-${i}-${viewport.width}.png`),fullPage:true});}await context.close();}
 assert.deepEqual(readFileSync('.local-data/preview.json'),actual,'Actual preview changed');
 const report={checkedAt:new Date().toISOString(),compiledBuild:true,localOnly:false,profiles:checks,settingsNoServiceConfig:true,explicitDTOs:true,revokedAndReboundSessionsDenied:true,forgedRoleIgnored:true,adminExistingCapabilitiesPreserved:true,explicitProjectLinksChecked:true,desktopAndMobile:true,readAndDeniedMutationBytesUnchanged:true,actualPreviewSHA256:createHash('sha256').update(actual).digest('hex'),productionTouched:false};writeFileSync(resolve(root,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
}finally{if(browser)await browser.close();if(process.platform==='win32'){const stop=spawn('taskkill',['/PID',String(server.pid),'/T','/F'],{stdio:'ignore'});await new Promise(r=>stop.once('exit',r));}else server.kill();}
