import { NextRequest,NextResponse } from 'next/server';
import { readPublicHbWorkspace } from '@/services/publicHbWorkspace';
import {applyPublicTaskCommand} from '@/services/workspaceService';
import {PUBLIC_HB_CSRF_COOKIE,validPublicHbCsrf} from '@/lib/publicHbCsrf';
import {sameRequestOrigin} from '@/lib/auth';
import {WorkspaceError} from '@/lib/projects';
export const dynamic='force-dynamic';
export async function GET(){
 try{return NextResponse.json(await readPublicHbWorkspace(),{headers:{'Cache-Control':'no-store'}});}
 catch{return NextResponse.json({error:'Datos HB no disponibles. La base existente no se inicializó ni se sustituyó.'},{status:503,headers:{'Cache-Control':'no-store'}});}
}
export async function POST(request:NextRequest){
 try{
  if(!sameRequestOrigin(request)||!validPublicHbCsrf(request.cookies.get(PUBLIC_HB_CSRF_COOKIE)?.value,request.headers.get('x-public-hb-csrf')))return NextResponse.json({error:'Origen o protección CSRF inválidos.'},{status:403});
  if(request.headers.get('content-type')?.split(';')[0].trim()!=='application/json')return NextResponse.json({error:'Se requiere JSON.'},{status:415});
  const raw=await request.text();if(Buffer.byteLength(raw)>131072)return NextResponse.json({error:'Solicitud demasiado grande.'},{status:413});
  let body;try{body=JSON.parse(raw);}catch{return NextResponse.json({error:'Solicitud JSON inválida.'},{status:400});}
  const result=await applyPublicTaskCommand(body) as {id:string;revision:number};
  return NextResponse.json({taskId:result.id,revision:result.revision,saved:true},{headers:{'Cache-Control':'no-store'}});
 }catch(error){return NextResponse.json({error:error instanceof WorkspaceError?error.message:'No se confirmó el guardado. Verifica antes de reintentar.'},{status:error instanceof WorkspaceError?error.status:503});}
}
export function PUT(){return NextResponse.json({error:'Operación no permitida.'},{status:405,headers:{Allow:'GET, HEAD, POST'}});}export const PATCH=PUT;export const DELETE=PUT;
