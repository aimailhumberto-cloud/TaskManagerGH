import {resolveBrainNode, type IdentityNode} from './smjIdentity';
import {type ContactLink} from './contactLayer';
const endpoint=(v:ContactLink['source'])=>typeof v==='string'?v:v.id;
const refs=(v:unknown):string[]=>Array.isArray(v)?v.flatMap(refs):typeof v==='string'?[v]:[];
const labels:Record<string,string>={distributors:'Distribución confirmada',has_contact:'Contacto vinculado',contact_for:'Contacto vinculado',has_channel:'Canal',channel_of:'Distribuidor',has_account:'Cadena / cuenta',in_channel:'Canal',has_outlet:'Punto de atención',outlet_of:'Distribuidor',has_listing:'Referencia de catálogo',listed_by_customer:'Retailer',listed_by_distributor:'Distribuidor',references_brand:'Marca',references_line:'Línea',market:'Mercado',belongs_to_market:'Mercado',historical_serves:'Relación histórica · otras marcas',historical_served_by:'Relación histórica · otras marcas',retail_accounts:'Cadena / cuenta',has_project:'Proyecto',related_project:'Proyecto',references_packaging:'Empaque',documented_in_market:'Mercado documentado'};
const supported=new Set(Object.keys(labels));
labels.research_accounts='Cuenta en investigación · proveedor por verificar'; supported.add('research_accounts');
labels.carries_line='Línea publicada en catálogo'; supported.add('carries_line');
labels.documented_product_lines='Línea documentada'; supported.add('documented_product_lines');
labels.coordinates_with='Coordinación SMJ'; supported.add('coordinates_with');
for(const key of ['carries_brand','carries_brands','active_brands']){labels[key]='Marca documentada';supported.add(key);}
/** Resolve only typed links or declared relations, never proximity or a country-name guess. */
export function commercialConnections(node:IdentityNode,nodes:IdentityNode[],links:ContactLink[]){
 const grouped=new Map<string,Set<string>>();const byId=new Map(nodes.map(n=>[n.id,n]));
 const add=(id:string,relation:string)=>{if(id===node.id||!byId.has(id)||!supported.has(relation))return;const set=grouped.get(id)||new Set<string>();set.add(labels[relation]);grouped.set(id,set);};
 for(const l of links){const s=endpoint(l.source),t=endpoint(l.target);if(s===node.id)add(t,l.relationType||'');if(t===node.id)add(s,l.relationType||'');}
 for(const [key,value] of Object.entries(node.frontmatter?.relations||{})){if(!supported.has(key))continue;for(const ref of refs(value)){const found=resolveBrainNode(nodes,ref);if(found.kind==='found')add(found.node.id,key);}}
 return [...grouped].map(([id,tags])=>({node:byId.get(id)!,labels:[...tags]})).sort((a,b)=>(a.node.title||a.node.id).localeCompare(b.node.title||b.node.id));
}
