import {NextRequest,NextResponse} from 'next/server';
import {sameRequestOrigin} from '@/lib/auth';
import {PUBLIC_HB_CSRF_COOKIE,validPublicHbCsrf} from '@/lib/publicHbCsrf';
import {WorkspaceError} from '@/lib/projects';
import {saveSmjRecord} from '@/services/smjTrackingService';
export const dynamic='force-dynamic';
export async function POST(request:NextRequest){try{
 if(!sameRequestOrigin(request)||!validPublicHbCsrf(request.cookies.get(PUBLIC_HB_CSRF_COOKIE)?.value,request.headers.get('x-public-hb-csrf')))return NextResponse.json({error:'Origen o protección CSRF inválidos.'},{status:403});
 if(request.headers.get('content-type')?.split(';')[0]!=='application/json')return NextResponse.json({error:'Se requiere JSON.'},{status:415});
 const raw=await request.text();if(Buffer.byteLength(raw)>16384)return NextResponse.json({error:'Registro demasiado grande.'},{status:413});let body;try{body=JSON.parse(raw);}catch{return NextResponse.json({error:'JSON inválido.'},{status:400});}
 return NextResponse.json(await saveSmjRecord(body),{headers:{'Cache-Control':'no-store'}});
 }catch(e){return NextResponse.json({error:e instanceof WorkspaceError?e.message:'No se confirmó el guardado SMJ; verifica antes de reintentar.'},{status:e instanceof WorkspaceError?e.status:503});}}
