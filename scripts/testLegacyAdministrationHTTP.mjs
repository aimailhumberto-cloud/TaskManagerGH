import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {randomBytes,createHmac} from 'node:crypto';
import {chromium} from '@playwright/test';

const origin='http://127.0.0.1:47918';
assert(!['.env','.env.local','.env.production','.env.production.local'].some(existsSync));
const before=readFileSync('.local-data/preview.json');
mkdirSync('.local-data/legacy-http-qa',{recursive:true});
const root=mkdtempSync(resolve('.local-data/legacy-http-qa/run-'));
const actor={userId:'usr-5ry71br',personId:'p1wq05qf'};
const other={userId:'synthetic-other',personId:'synthetic-other-person'};
const manager={userId:'synthetic-manager',personId:'synthetic-manager-person'};
const ids=Array.from({length:74},(_,i)=>'synthetic-legacy-http-'+i);
const fixture={companies:[{id:'synthetic-company',name:'Synthetic legacy company'}],people:[{id:actor.personId,name:'Synthetic HB',role:'Owner',avatar:''},{id:other.personId,name:'Synthetic other Owner',role:'Owner',avatar:''},{id:manager.personId,name:'Synthetic manager',role:'Gerente',avatar:''}],users:[actor,other,manager].map(a=>({id:a.userId,personId:a.personId,email:a.userId+'@synthetic.test',isActive:true})),tasks:[],projects:[],templates:[],agentQueue:[],reminders:[],automations:[],smtpConfig:{host:'',port:587,user:'',pass:''},legacyAdministration:{version:1,...actor,taskIds:ids,sourceSha256:'a'.repeat(64),approvedAt:'2026-10-09T12:38:00Z',approvalReference:'SYNTHETIC approved policy'}};
for(const id of ids){
 const task={id,title:'SYNTHETIC Legacy '+id,description:'Synthetic data only',companyId:'synthetic-company',assigneeId:manager.personId,assigneeIds:[manager.personId],type:'One-shot',status:'Pending',priority:'Medium',origin:'Manual',dueDate:'2026-10-14T15:00:00+00:00',workDate:'2026-10-09',steps:[],attachments:[],revision:0,activityLog:[{timestamp:'2026-06-01T12:00:00Z',user:'System',type:'User',action:'Synthetic original history'}]};
 const snapshot=structuredClone(task);delete snapshot.activityLog;
 task.activityLog.push({timestamp:new Date().toISOString(),user:actor.personId,type:'User',action:'Synthetic imported snapshot',revision:0,snapshot});fixture.tasks.push(task);
}
fixture.tasks.push({...structuredClone(fixture.tasks[0]),id:'synthetic-unlisted'});
const database=resolve(root,'database.json');writeFileSync(database,JSON.stringify(fixture));
const secret=randomBytes(48).toString('hex');
const env={...process.env,DATABASE_PATH:database,SESSION_SECRET:secret,TASKMANAGER_LOCAL_ONLY:'0',TASKMANAGER_EXTERNAL_ACTIONS_ENABLED:'0',TASKMANAGER_ATTACHMENTS_DIRECTORY:root,NODE_ENV:'production',NEXT_TELEMETRY_DISABLED:'1'};
for(const key of Object.keys(env))if(/SUPABASE|SMTP|TELEGRAM|API_KEY|SERVICE_ROLE|OPENAI|ANTHROPIC|GOOGLE|WHATSAPP/i.test(key))delete env[key];
const server=spawn(process.execPath,['node_modules/next/dist/bin/next','start','-H','127.0.0.1','-p','47918'],{env,stdio:'ignore'});
const token=a=>{const payload=Buffer.from(JSON.stringify({...a,email:'synthetic@legacy.test',role:'Owner',createdAt:new Date().toISOString()})).toString('base64url');return payload+'.'+createHmac('sha256',secret).update(payload).digest('base64url');};
const headers=a=>{const session=token(a);return {cookie:'hermes_session='+session,origin,'content-type':'application/json','x-csrf-token':createHmac('sha256',secret).update('taskmanager-csrf:'+session).digest('hex')};};
const request=(a,path,options={})=>fetch(origin+path,{...options,headers:{...headers(a),...options.headers},redirect:'manual'});
const command=(a,body)=>request(a,'/api/workspace',{method:'POST',body:JSON.stringify(body)});
const saved=()=>JSON.parse(readFileSync(database,'utf8'));
let browser;
try{
 let ready=false;for(let n=0;n<100;n++){if(server.exitCode!==null)throw Error('Isolated server stopped');try{if((await fetch(origin+'/login')).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,200));}assert(ready);
 for(const a of [actor,other,manager]){const r=await request(a,'/api/workspace?day=2026-10-09');assert.equal(r.status,200);const text=await r.text();assert(!text.includes('sourceSha256'));assert(!text.includes('approvalReference'));assert.equal(JSON.parse(text).managedLegacyTaskIds.length,a===actor?74:0);}
 const edit={action:'updateTask',id:ids[0],requestId:'synthetic-http-edit',expectedRevision:0,reason:'Synthetic compatibility check',fields:{title:'SYNTHETIC Edited',ownerId:other.personId,dueDate:'2026-10-14'}};
 for(const a of [other,manager])assert.equal((await command(a,edit)).status,403);
 assert.equal((await command(actor,{...edit,id:'synthetic-unlisted',requestId:'synthetic-unlisted'})).status,403);
 assert.equal((await command(actor,edit)).status,200);assert.equal((await command(actor,edit)).status,200);
 let task=saved().tasks[0];assert.equal(task.revision,1);assert.equal(task.ownerId,undefined);assert.equal(task.dueDate,fixture.tasks[0].dueDate);assert.deepEqual(task.assigneeIds,[manager.personId]);
 assert.equal((await command(actor,{...edit,requestId:'synthetic-stale'})).status,409);
 const upload=async(a,name)=>{const form=new FormData();form.set('taskId',ids[0]);form.set('file',new Blob(['Synthetic attachment only']),name);return fetch(origin+'/api/attachments',{method:'POST',headers:{cookie:headers(a).cookie,origin},body:form});};
 assert.equal((await upload(other,'synthetic-denied.txt')).status,403);
 assert.equal((await upload(actor,'synthetic-evidence.txt')).status,201);
 assert.equal((await upload(actor,'synthetic-evidence.txt')).status,409);
 task=saved().tasks[0];assert.equal(task.revision,2);assert.equal(task.attachments.length,1);assert.equal(task.ownerId,undefined);assert.equal(task.activityLog.at(-1).user,actor.personId);
 assert.equal((await command(actor,{action:'restoreTask',id:ids[0],requestId:'synthetic-http-restore',expectedRevision:2,reason:'Synthetic restore',fields:{revision:0}})).status,200);
 task=saved().tasks[0];assert.equal(task.title,fixture.tasks[0].title);assert.equal(task.attachments.length,0);assert.equal(task.ownerId,undefined);
 const download=await request(actor,'/data/attachments/synthetic-evidence.txt');assert.equal(download.status,200);assert.equal(await download.text(),'Synthetic attachment only');
 writeFileSync(resolve(root,'synthetic-unlinked.txt'),'Unlinked synthetic evidence');assert.equal((await request(actor,'/data/attachments/synthetic-unlinked.txt')).status,404);
 browser=await chromium.launch({headless:true});const context=await browser.newContext({viewport:{width:1440,height:1000}});
 await context.addCookies([{name:'hermes_session',value:token(actor),url:origin,httpOnly:true,secure:true,sameSite:'Lax'}]);
 const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(origin+'/buscar',{waitUntil:'networkidle'});
 if(!(await page.locator('input[aria-label="Buscar trabajo y fuentes"]').count())) throw Error('Synthetic browser page '+page.url()+' '+(await page.textContent('body')).slice(0,650));
 await page.getByLabel('Buscar trabajo y fuentes',{exact:true}).fill(fixture.tasks[0].title);
 await page.locator('button').filter({has:page.getByText(fixture.tasks[0].title,{exact:true})}).first().click();
 const form=page.getByRole('form',{name:'Editar trabajo'});await form.locator('input[name="title"]').fill('SYNTHETIC Browser edited');await form.locator('input[name="reason"]').fill('Synthetic browser compatibility');await form.getByRole('button',{name:'Guardar trabajo'}).click();
 await page.getByRole('status').filter({hasText:'Cambio guardado'}).waitFor();assert.equal(saved().tasks[0].title,'SYNTHETIC Browser edited');assert.equal(saved().tasks[0].ownerId,undefined);
 await page.getByRole('button',{name:'Cerrar detalle',exact:true}).click();await page.reload({waitUntil:'networkidle'});await page.getByLabel('Buscar trabajo y fuentes',{exact:true}).fill('SYNTHETIC Browser edited');assert((await page.textContent('body')).includes('SYNTHETIC Browser edited'));
 await page.setViewportSize({width:390,height:844});await page.reload({waitUntil:'networkidle'});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),true);assert.deepEqual(errors,[]);
 const revoked=saved();revoked.users.find(u=>u.id===actor.userId).isActive=false;writeFileSync(database,JSON.stringify(revoked));assert.equal((await request(actor,'/api/workspace')).status,401);
 assert.deepEqual(readFileSync('.local-data/preview.json'),before);
 const report={syntheticOnly:true,productionTouched:false,approved74Only:true,HTTPRetryConflict:true,ownersPreserved:true,attachmentsAudited:true,existingFilesNeverOverwritten:true,historicalEvidenceAccessible:true,unlinkedFilesDenied:true,browserSaveReload:true,mobile:true,revokedSessionDenied:true,actualPreviewUnchanged:true};writeFileSync(resolve(root,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({...report,reportPath:resolve(root,'report.json')}));
}finally{if(browser)await browser.close();server.kill();}
