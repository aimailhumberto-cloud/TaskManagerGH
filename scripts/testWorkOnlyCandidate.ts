import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
async function main(){
 const pg=new PGlite();try{
  await pg.exec('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;');await pg.exec(await readFile('scripts/fixtures/original-schema-metadata.sql','utf8'));
  for(let i=1;i<=7;i++)await pg.query('INSERT INTO companies VALUES($1,$2)',['comp'+i,'Synthetic company '+i]);
  const people=['p1wq05qf','synthetic-p2','synthetic-p3','synthetic-p4','synthetic-p5','synthetic-p6','synthetic-p7','synthetic-p8'];
  for(const id of people)await pg.query('INSERT INTO people(id,name,role,avatar,company_id) VALUES($1,$2,$3,$4,$5)',[id,'Synthetic person',id==='p1wq05qf'?'Owner':'Member','','comp1']);
  for(let i=0;i<5;i++)await pg.query('INSERT INTO users(id,person_id,email,password_hash,salt) VALUES($1,$2,$3,$4,$5)',[i===0?'usr-5ry71br':'synthetic-user-'+i,people[i],'synthetic'+i+'@example.test','SYNTHETIC_AUTH_SENTINEL','SYNTHETIC_SALT_SENTINEL']);
  await pg.query('INSERT INTO smtp_config VALUES($1,$2,$3,$4,$5,$6)',['synthetic-smtp','smtp.invalid',587,false,'SYNTHETIC_SMTP_USER','SYNTHETIC_SMTP_SECRET']);
  for(let i=0;i<74;i++)await pg.query('INSERT INTO tasks(id,title,description,type,company_id,assignee_id,status,priority,origin,due_date) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',['synthetic-'+i,'Synthetic task '+i,'','One-shot','comp1',people[0],'Pending','Medium','Manual','2026-10-11T15:00:00Z']);
  const before=(await pg.query('SELECT count(*)::int AS tasks FROM tasks')).rows;
  const sql=await readFile('.local-data/work-only-candidate-audit.sql','utf8');
  assert(!/public\.(smtp_config)|password_hash|auth_pass|auth_user|\bsalt\b/.test(sql));
  const audit=(await pg.query<{audit:any}>(sql)).rows[0].audit;
  assert.equal(audit.tasks,87);assert.equal(audit.companies,14);assert.equal(audit.people,8);assert.equal(audit.originalAccounts,5);assert.equal(audit.originalTasksPreserved,74);assert.equal(audit.reminders,1);assert.equal(audit.duplicateTasks,0);assert.equal(audit.duplicateCompanies,0);assert.equal(audit.invalidTaskCompanies,0);assert.equal(audit.invalidTaskAssignees,0);assert.equal(audit.protectedCollectionsPresent,false);assert.equal(audit.originalOwnerActive,true);assert.deepEqual((await pg.query('SELECT count(*)::int AS tasks FROM tasks')).rows,before);
  console.log(JSON.stringify({isolatedPostgres:true,queryWorkOnly:true,accountsAndConfigurationNotSelected:true,originalTasksPreserved:74,candidateTasks:87,duplicateTasks:0,duplicateCompanies:0,existingReminderPreserved:true,productionTouched:false}));
 }finally{await pg.close();}
}
main().catch(error=>{console.error(error.message);process.exitCode=1;});
