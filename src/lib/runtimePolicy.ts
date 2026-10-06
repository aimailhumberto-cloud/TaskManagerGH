// Permanent restrictions are separate from local preview. Enabling outbound routes
// requires an explicit release decision; availability of credentials is not permission.
export function legacyWriteBlocked(path:string):boolean {return /^\/api\/(tasks|companies|persons)(\/|$)/.test(path);}
export function externalRouteBlocked(path:string, env:Record<string,string|undefined>):boolean {
 return /^\/api\/(ai|telegram|agent|meetings|tasks\/share-email)(\/|$)/.test(path) && (env.TASKMANAGER_LOCAL_ONLY==='1' || env.TASKMANAGER_EXTERNAL_ACTIONS_ENABLED!=='1');
}
