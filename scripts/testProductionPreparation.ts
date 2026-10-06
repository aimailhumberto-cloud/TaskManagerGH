import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { resolve,join } from 'node:path';
import { attachmentDirectory,attachmentFile } from '../src/lib/attachmentStorage';
import { externalRouteBlocked,legacyWriteBlocked } from '../src/lib/runtimePolicy';
async function main(){
 const root=await mkdtemp(resolve('.local-data/storage-test-'));const env={NODE_ENV:'production',TASKMANAGER_ATTACHMENTS_DIRECTORY:root};
 try{
 assert.throws(()=>attachmentDirectory({NODE_ENV:'production'}),/persistente/);assert.throws(()=>attachmentDirectory({TASKMANAGER_ATTACHMENTS_DIRECTORY:'relative'}),/absoluta/);
 for(const name of ['../private','..\\private','/private','C:\\private','..','.','file:stream','file\n'])assert.throws(()=>attachmentFile(name,env));
 const file=attachmentFile('evidence.txt',env);await writeFile(file,'synthetic-evidence',{flag:'wx'});assert.equal(await readFile(file,'utf8'),'synthetic-evidence');await assert.rejects(writeFile(file,'overwrite',{flag:'wx'}),{code:'EEXIST'});assert.equal(await readFile(file,'utf8'),'synthetic-evidence');
 assert(legacyWriteBlocked('/api/tasks/one'));assert(legacyWriteBlocked('/api/companies'));assert(!legacyWriteBlocked('/api/workspace'));assert(externalRouteBlocked('/api/meetings/send',{}));assert(externalRouteBlocked('/api/tasks/share-email',{TASKMANAGER_EXTERNAL_ACTIONS_ENABLED:'1',TASKMANAGER_LOCAL_ONLY:'1'}));assert(!externalRouteBlocked('/api/tasks/share-email',{TASKMANAGER_EXTERNAL_ACTIONS_ENABLED:'1'}));assert(!externalRouteBlocked('/api/integrations/whatsapp/status',{}));
 console.log('PASS isolated attachment paths/persistence/no overwrite and permanent production restrictions');
 }finally{await rm(root,{recursive:true,force:true});}
}main().catch(e=>{console.error(e);process.exitCode=1;});
