import type { IdentityNode } from './smjIdentity';
export interface PortfolioLink { source: string | { id: string }; target: string | { id: string }; relationType?: string }
const endpoint=(v:PortfolioLink['source'])=>typeof v==='string'?v:v.id;
const catalogTypes=new Set(['product_line','product_variant','packaging','flavor']);
const parentRelations=new Set(['belongs_to_brand','belongs_to_line']);
const childRelations=new Set(['has_product_line','has_product_variant','has_packaging','has_flavor','contains_variant']);
const portfolioRelations=new Set([...parentRelations,...childRelations,'packaging','flavor','belongs_to_company','active_in_markets','documented_in_markets','distributed_by','catalog_market','reported_in_market','reported_by','listed_by','historical_brand_presence']);

/** Follow explicit catalog relationships. Names are labels, never membership evidence. */
export function brandCatalogNodes<T extends IdentityNode>(brandId:string,nodes:T[],links:PortfolioLink[]):T[]{
 const byId=new Map(nodes.map(n=>[n.id,n]));const children=new Map<string,Set<string>>();
 const add=(parent:string,child:string)=>{if(!catalogTypes.has(byId.get(child)?.type||''))return;const ids=children.get(parent)||new Set<string>();ids.add(child);children.set(parent,ids);};
 for(const l of links){const s=endpoint(l.source),t=endpoint(l.target);if(parentRelations.has(l.relationType||''))add(t,s);if(childRelations.has(l.relationType||''))add(s,t);}
 const seen=new Set<string>([brandId]);const queue=[brandId];
 for(let i=0;i<queue.length;i++)for(const id of children.get(queue[i])||[]){if(seen.has(id))continue;seen.add(id);queue.push(id);}
 return nodes.filter(n=>n.id!==brandId&&seen.has(n.id)&&catalogTypes.has(n.type||''));
}

export function portfolioNeighbors<T extends IdentityNode>(id:string,nodes:T[],links:PortfolioLink[]):T[]{
 const ids=new Set<string>();
 for(const l of links){if(!portfolioRelations.has(l.relationType||''))continue;const s=endpoint(l.source),t=endpoint(l.target);if(s===id)ids.add(t);if(t===id)ids.add(s);}
 return nodes.filter(n=>n.id!==id&&ids.has(n.id));
}

export function packagingDescription(fm:Record<string,any>){
 const raw=String(fm.container_raw||fm.container_type||'');
 const container=raw==='Bottles'?'Botella':raw==='Cans'?'Lata':!raw||raw==='Not stated'?'No especificado':raw;
 const units=fm.units_per_case_raw??fm.units_per_case;
 return {container,configuration:units&&units!=='Not stated'?`Caja x ${units}`:'No especificada',size:fm.size_raw||'No especificado'};
}
