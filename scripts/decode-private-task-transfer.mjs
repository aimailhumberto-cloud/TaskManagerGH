import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,relative,isAbsolute,dirname} from 'node:path';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
const expected='86a8c1f5bf18dc31a625354eb71ad437d69c070f8c4abf7f4ab1d848b99f7ee2';
try{
 const [one,two,three,destination]=process.argv.slice(2);
 if(!one||!two||!three||!destination)throw Error();
 const root=resolve('.local-data'),target=resolve(destination),within=relative(root,target);
 if(!within||within.startsWith('..')||isAbsolute(within)||[one,two,three].some(p=>resolve(p)===target))throw Error();
 const parts=await Promise.all([one,two,three].map(p=>readFile(p,'utf8')));
 const encoded=parts.map(p=>p.replace(/\s/g,'')).join('');
 if(!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded)||encoded.length%4)throw Error();
 const compressed=Buffer.from(encoded,'base64');if(compressed.toString('base64')!==encoded)throw Error();
 const bytes=gunzipSync(compressed,{maxOutputLength:2*1024*1024});
 const sha256=createHash('sha256').update(bytes).digest('hex');if(sha256!==expected)throw Error();
 const value=JSON.parse(bytes.toString('utf8')),tasks=Array.isArray(value)?value:value.tables?.tasks||value.tasks;
 if(!Array.isArray(tasks)||tasks.length!==74||tasks.some(t=>!t||typeof t.id!=='string'||!t.id)||new Set(tasks.map(t=>t.id)).size!==74)throw Error();
 await mkdir(dirname(target),{recursive:true});await writeFile(target,bytes,{flag:'wx',mode:0o600});
 console.log(JSON.stringify({verified:true,sha256,tasks:74,databaseChanged:false,backupScope:'task-export-not-complete-database'}));
}catch{console.error('Transferencia rechazada: se requieren los tres fragmentos íntegros, gzip válido, SHA-256 esperado, 74 IDs únicos y destino privado nuevo. No se modificó ninguna base.');process.exitCode=1;}
