// Byte-for-byte packaging of the approved image. No remote downloads or credentials.
const {readFileSync,readdirSync,mkdirSync,writeFileSync}=require('node:fs');
const {join,resolve}=require('node:path');
const {createHash}=require('node:crypto');
const root=resolve(__dirname,'..');
const directory=join(root,'assets','hb-lake-hero');
const files=readdirSync(directory).filter(p=>/^\d{3}\.b64$/.test(p)).sort();
if(files.length!==41)throw Error('Incomplete approved workspace image');
const encoded=files.map(p=>readFileSync(join(directory,p),'utf8')).join('');
if(!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded))throw Error('Invalid workspace image packaging');
const image=Buffer.from(encoded,'base64');
const expected='b47bcf439cae46251e37de0fb0a87f7c711d582a51767abd1e3c357c196d2e8d';
if(image.length!==1825761||createHash('sha256').update(image).digest('hex')!==expected)throw Error('Approved workspace image failed integrity verification');
mkdirSync(join(root,'public','workspace'),{recursive:true});
writeFileSync(join(root,'public','workspace','hb-lake-hero.png'),image);
console.log('Approved workspace image restored; SHA256 verified.');
