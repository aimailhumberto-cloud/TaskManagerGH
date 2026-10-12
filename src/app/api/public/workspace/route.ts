import { NextResponse } from 'next/server';
import { readPublicHbWorkspace } from '@/services/publicHbWorkspace';
export const dynamic='force-dynamic';
export async function GET(){
 try{return NextResponse.json(await readPublicHbWorkspace(),{headers:{'Cache-Control':'no-store'}});}
 catch{return NextResponse.json({error:'Datos HB no disponibles. La base existente no se inicializó ni se sustituyó.'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
export function POST(){return NextResponse.json({error:'El acceso público solo permite consulta.'},{status:405,headers:{Allow:'GET, HEAD'}});}
export const PUT=POST;export const PATCH=POST;export const DELETE=POST;
