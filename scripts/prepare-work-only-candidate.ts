import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {workDataOnly} from '../src/services/originalAccounts';

// Produces read-only SQL; no connections, original account/configuration fields never selected.
async function main(){
 const delta=JSON.parse(await readFile('.local-data/deployment-transfer-20261009/authorized-local-delta-v2.json','utf8'));
 if(delta.tasks.length!==13||new Set(delta.tasks.map((t:any)=>t.id)).size!==13||delta.companies.length!==7||delta.reminders.length!==1)throw Error('Reconcile authorized delta before preparing');
 if(JSON.stringify(workDataOnly({work:delta}).work)!==JSON.stringify(delta))throw Error('Protected fields in local delta');
 delta.heroPreferences=delta.heroPreferences.map((p:any)=>({...p,id:p.id==='local-humberto'?'p1wq05qf':p.id}));
 const local=JSON.stringify({tasks:delta.tasks,companies:delta.companies,reminders:delta.reminders,automations:delta.automations,heroPreferences:delta.heroPreferences}).replace(/'/g,"''");
 const sql=`WITH local AS (SELECT '${local}'::jsonb AS d),
 source AS (SELECT jsonb_build_object(
 'companies',(SELECT coalesce(jsonb_agg(to_jsonb(c) ORDER BY c.id),'[]'::jsonb) FROM public.companies c),
 'people',(SELECT coalesce(jsonb_agg(to_jsonb(p) ORDER BY p.id),'[]'::jsonb) FROM public.people p),
 'tasks',(SELECT coalesce(jsonb_agg(to_jsonb(t) ORDER BY t.id),'[]'::jsonb) FROM public.tasks t),
 'templates',(SELECT coalesce(jsonb_agg(to_jsonb(e) ORDER BY e.id),'[]'::jsonb) FROM public.email_templates e WHERE e.id<>'ollama_ai_config'),
 'agentQueue',(SELECT coalesce(jsonb_agg(to_jsonb(a) ORDER BY a.id),'[]'::jsonb) FROM public.agent_queue a)) AS s),
 normalized AS (SELECT to_jsonb(t)||coalesce(substring(coalesce(t.description,'') FROM '<!-- HERMES_MEETING_METADATA: (.*?) -->')::jsonb,'{}'::jsonb)||jsonb_build_object(
 'id',t.id,'title',t.title,'description',trim(regexp_replace(coalesce(t.description,''),'<!-- HERMES_MEETING_METADATA: (.*?) -->','')),'type',t.type,
 'companyId',coalesce(t.company_id,''),'assigneeId',coalesce(t.assignee_id,''),'assigneeIds',coalesce(to_jsonb(t.assignee_ids),'[]'::jsonb),
 'steps',coalesce(to_jsonb(t.steps),'[]'::jsonb),'attachments',coalesce(to_jsonb(t.attachments),'[]'::jsonb),'activityLog',coalesce(to_jsonb(t.activity_log),'[]'::jsonb),
 'status',t.status,'priority',t.priority,'origin',t.origin,'dueDate',coalesce(to_jsonb(t)->>'due_date',''),'revision',0)||CASE WHEN coalesce(t.repeat_pattern,'')<>'' THEN jsonb_build_object('repeatPattern',t.repeat_pattern) ELSE '{}'::jsonb END AS item FROM public.tasks t),
 snapshots AS (SELECT item||jsonb_build_object('activityLog',item->'activityLog'||jsonb_build_array(jsonb_build_object('timestamp','2026-10-09T12:38:00Z','user','p1wq05qf','type','User','action','Estado inicial importado; administración autorizada sin atribución de propiedad','revision',0,'snapshot',item-'activityLog'))) AS item FROM normalized),
 candidate AS (SELECT jsonb_build_object(
 'companies',(s->'companies')||(d->'companies'),
 'people',(SELECT jsonb_agg(to_jsonb(p)||CASE WHEN coalesce(p.company_id,'')<>'' THEN jsonb_build_object('companyId',p.company_id) ELSE '{}'::jsonb END ORDER BY p.id) FROM public.people p),
 'tasks',(SELECT jsonb_agg(item ORDER BY item->>'id') FROM snapshots)||(d->'tasks'),
 'templates',s->'templates','agentQueue',(SELECT coalesce(jsonb_agg(to_jsonb(a)||jsonb_build_object('taskId',a.task_id) ORDER BY a.id),'[]'::jsonb) FROM public.agent_queue a),
 'projects','[]'::jsonb,'decisions','[]'::jsonb,'dayPlans','[]'::jsonb,'appliedOperations','[]'::jsonb,
 'reminders',d->'reminders','automations',d->'automations','heroPreferences',d->'heroPreferences',
 'legacyAdministration',jsonb_build_object('version',1,'userId','usr-5ry71br','personId','p1wq05qf','taskIds',(SELECT jsonb_agg(id ORDER BY id) FROM public.tasks),'sourceSha256',encode(sha256(convert_to(s::text,'UTF8')),'hex'),'approvedAt','2026-10-09T12:38:00Z','approvalReference','HB Owner74 autorización 2026-10-09T12:38Z')) AS document,s AS original_work FROM source CROSS JOIN local)
 SELECT jsonb_build_object('tasks',jsonb_array_length(document->'tasks'),'companies',jsonb_array_length(document->'companies'),'people',jsonb_array_length(document->'people'),'originalAccounts',(SELECT count(*) FROM public.users),'reminders',jsonb_array_length(document->'reminders'),'automations',jsonb_array_length(document->'automations'),
 'duplicateTasks',(SELECT count(*)-count(DISTINCT t->>'id') FROM jsonb_array_elements(document->'tasks') t),
 'duplicateCompanies',(SELECT count(*)-count(DISTINCT c->>'id') FROM jsonb_array_elements(document->'companies') c),
 'invalidTaskCompanies',(SELECT count(*) FROM jsonb_array_elements(document->'tasks') t WHERE coalesce(t->>'companyId','')<>'' AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(document->'companies') c WHERE c->>'id'=t->>'companyId')),
 'invalidTaskAssignees',(SELECT count(*) FROM jsonb_array_elements(document->'tasks') t WHERE coalesce(t->>'assigneeId','')<>'' AND NOT EXISTS(SELECT 1 FROM jsonb_array_elements(document->'people') p WHERE p->>'id'=t->>'assigneeId')),
 'originalTasksPreserved',(SELECT count(*) FROM public.tasks x WHERE EXISTS(SELECT 1 FROM jsonb_array_elements(document->'tasks') t WHERE t->>'id'=x.id AND t->>'status'=x.status AND t->'steps'=coalesce(to_jsonb(x.steps),'[]'::jsonb) AND t->'attachments'=coalesce(to_jsonb(x.attachments),'[]'::jsonb) AND (SELECT coalesce(jsonb_agg(e.v ORDER BY e.n),'[]'::jsonb) FROM jsonb_array_elements(t->'activityLog') WITH ORDINALITY e(v,n) WHERE e.n<=jsonb_array_length(coalesce(to_jsonb(x.activity_log),'[]'::jsonb)))=coalesce(to_jsonb(x.activity_log),'[]'::jsonb))),
 'originalOwnerActive',EXISTS(SELECT 1 FROM public.users u JOIN public.people p ON p.id=u.person_id WHERE u.id='usr-5ry71br' AND u.person_id='p1wq05qf' AND u.is_active AND p.role='Owner'),
 'protectedCollectionsPresent',document ?| ARRAY['users','smtpConfig','aiConfig'],
 'workSourceSha256',encode(sha256(convert_to(original_work::text,'UTF8')),'hex'),'candidateSha256',encode(sha256(convert_to(document::text,'UTF8')),'hex'),'imported',false) AS audit FROM candidate;
 `;
 const destination=resolve('.local-data/work-only-candidate-audit.sql');await mkdir(resolve('.local-data'),{recursive:true});await writeFile(destination,sql,{flag:'wx'});console.log(JSON.stringify({prepared:true,readOnly:true,workDataOnly:true,accountsCopied:false,configurationRead:false,destination}));
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
