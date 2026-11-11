export interface IdentityNode { id: string; title?: string; type?: string; frontmatter?: Record<string, any>; country?: string; department?: string; }
export function normalizeBrainText(value: unknown): string {
  return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().trim().replace(/\s+/g, ' ');
}
export function humanNodeName(node: IdentityNode): string {
  const title=String(node.title || node.id);
  return node.type==='person' ? title.replace(/^(?:person|persona)\s*[:\-]\s*/i,'').trim() : title;
}
function names(node: IdentityNode): string[] {
  const aliases=node.frontmatter?.aliases;
  return [node.id,node.title,humanNodeName(node),...(Array.isArray(aliases)?aliases:typeof aliases==='string'?[aliases]:[])].filter(x=>typeof x==='string').map(normalizeBrainText);
}
export function canonicalPool<T extends IdentityNode>(pool: T[]): T[] {
  return [...new Map(pool.map(n=>[n.id,n])).values()];
}
export function searchBrainNodes<T extends IdentityNode>(pool:T[], query:string):T[] {
  const q=normalizeBrainText(query);if(!q)return [];
  const rank=(n:T)=>{
    const title=normalizeBrainText(n.title).replace(/^(?:person|persona|market|distributor|customer|brand|linea)\s*[:\-]\s*/,'');
    if(title===q||names(n).includes(q))return 0;
    if(title.startsWith(q))return 1;
    if(names(n).some(name=>name.includes(q)))return 2;
    return 3;
  };
  return canonicalPool(pool).filter(n=>[...names(n),normalizeBrainText(n.frontmatter?.job_title || n.frontmatter?.role),normalizeBrainText(n.department || n.frontmatter?.department),normalizeBrainText(n.country || n.frontmatter?.based_in_country)].some(value=>value.includes(q))).sort((a,b)=>rank(a)-rank(b));
}
export function resolveBrainNode<T extends IdentityNode>(pool:T[], raw:string):{kind:'found';node:T}|{kind:'ambiguous';candidates:T[]}|{kind:'missing'} {
  const clean=raw.replace(/^\[\[|\]\]$/g,'').split('|')[0].trim();const q=normalizeBrainText(clean);
  const unique=canonicalPool(pool);const byId=unique.find(n=>normalizeBrainText(n.id)===q);
  if(byId)return {kind:'found',node:byId};
  const unprefixed=q.replace(/^(?:person|persona)\s*[:\-]\s*/,'');
  const candidates=unique.filter(n=>names(n).some(name=>name===q || name===unprefixed));
  return candidates.length===1?{kind:'found',node:candidates[0]}:candidates.length?{kind:'ambiguous',candidates}:{kind:'missing'};
}
export function fitIdentityBounds(nodes:{x:number;y:number}[],width:number,height:number,panelOpen:boolean,mobile:boolean){
  const valid=nodes.filter(n=>Number.isFinite(n.x)&&Number.isFinite(n.y));if(!valid.length)return null;
  const visibleW=mobile?width:Math.max(220,width-(panelOpen?520:0));
  const visibleH=mobile&&panelOpen?Math.max(180,height*.4):height;
  const pad=Math.min(90,visibleW*.16,visibleH*.2);
  const xs=valid.map(n=>n.x),ys=valid.map(n=>n.y);
  const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
  const scale=Math.max(.08,Math.min(1.05,(visibleW-pad*2)/Math.max(180,maxX-minX),(visibleH-pad*2)/Math.max(180,maxY-minY)));
  return {x:visibleW/2-(minX+maxX)/2*scale,y:visibleH/2-(minY+maxY)/2*scale,scale,visibleW,visibleH,pad};
}
