import path from 'node:path';
export function attachmentDirectory(env: Record<string,string|undefined> = process.env): string {
 const configured=env.TASKMANAGER_ATTACHMENTS_DIRECTORY;
 if(configured){if(!path.isAbsolute(configured))throw Error('La ruta de adjuntos debe ser absoluta.');return path.resolve(configured);}
 if(env.NODE_ENV==='production' && env.TASKMANAGER_LOCAL_ONLY!=='1')throw Error('Almacenamiento persistente de adjuntos no configurado.');
 return path.join(process.cwd(),'data','attachments');
}
export function attachmentFile(filename:string, env:Record<string,string|undefined>=process.env):string {
 if(!filename || filename==='.' || filename==='..' || /[\\/\x00-\x1f:"<>|?*]/.test(filename) || filename!==path.basename(filename) || filename!==path.win32.basename(filename))throw Error('Nombre de adjunto inválido.');
 return path.join(attachmentDirectory(env),filename);
}

