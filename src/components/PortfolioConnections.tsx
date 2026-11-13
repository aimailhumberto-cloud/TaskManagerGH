'use client';
import {portfolioNeighbors,type PortfolioLink} from '@/lib/portfolioConnections';
import {humanNodeName,type IdentityNode} from '@/lib/smjIdentity';
import {useConnT} from '@/lib/connectionsI18n';
const groups=[['Empresa',['core']],['Marca',['brand']],['Línea',['product_line']],['Mercados',['market']],['Distribución',['distributor','organization']],['Empaques',['packaging']],['Presentaciones',['product_variant']],['Sabores',['flavor']]] as const;
export function PortfolioConnections({node,nodes,links,onOpen}:{node:IdentityNode;nodes:IdentityNode[];links:PortfolioLink[];onOpen:(target:IdentityNode,source:string)=>void}){
 const {T}=useConnT();
 if(!['brand','product_line','product_variant','packaging','flavor','market'].includes(node.type||''))return null;
 const neighbors=portfolioNeighbors(node.id,nodes,links).filter(n=>node.type!=='brand'||!['product_line','product_variant','packaging','flavor'].includes(n.type||''));
 if(!neighbors.length)return null;
 const name=node.frontmatter?.brand_name||humanNodeName(node).replace(/^(Brand|Market|Linea):\s*/i,'');
 return <section aria-label={`${T('Conexiones de')} ${name}`} className="mb-3 rounded-xl border border-sky-700 bg-gray-950/90 p-3 text-xs">
  <h3 className="font-semibold text-sky-200">{T('Conexiones del portafolio')}</h3>
  {groups.map(([title,types])=>{
   const items=neighbors.filter(n=>(types as readonly string[]).includes(n.type||''));if(!items.length)return null;
   return <div key={title} className="mt-3">
    <h4 className="mb-1 font-medium text-gray-300">{T(title)} · {items.length}</h4>
    <ul className="grid max-h-56 grid-cols-2 gap-1 overflow-y-auto">
     {items.map(other=>{
      const evidence=node.frontmatter?.market_presence?.find((p:any)=>p.node_id===other.id);
      const label=other.frontmatter?.country_name||other.frontmatter?.brand_name||humanNodeName(other).replace(/^(Brand|Market|Linea|Distributor):\s*/i,'');
      return <li key={other.id}><button type="button" onClick={()=>onOpen(other,node.id)} className="h-full w-full rounded border border-gray-800 px-2 py-2 text-left text-sky-100 hover:border-sky-500 hover:bg-sky-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-sky-300">
       <span className="block break-words">{label}</span>
       {evidence&&<span className={`mt-1 block text-[10px] ${evidence.status==='historical_2023'?'text-amber-200':'text-emerald-200'}`}>{evidence.evidence_label}</span>}
      </button></li>;
     })}
    </ul>
   </div>;
  })}
 </section>;
}
