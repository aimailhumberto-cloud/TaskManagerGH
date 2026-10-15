import {NextRequest,NextResponse} from 'next/server';
import {validateApiKey} from '@/lib/auth';
import {WorkspaceError} from '@/lib/projects';
import {saveSmjRecord} from '@/services/smjTrackingService';
export const dynamic='force-dynamic';
export async function POST(request:NextRequest){
 const auth=await validateApiKey(request);if(!auth.valid)return NextResponse.json({error:auth.error},{status:auth.status});
 try{if(request.headers.get('content-type')?.split(';')[0]!=='application/json')return NextResponse.json({error:'Se requiere JSON.'},{status:415});const raw=await request.text();if(Buffer.byteLength(raw)>16384)return NextResponse.json({error:'Registro demasiado grande.'},{status:413});let body;try{body=JSON.parse(raw);}catch{return NextResponse.json({error:'JSON inválido.'},{status:400});}return NextResponse.json(await saveSmjRecord(body,auth.session!),{headers:{'Cache-Control':'private, no-store'}});
 }catch(error){return NextResponse.json({error:error instanceof WorkspaceError?error.message:'Guardado SMJ no confirmado; verifica antes de reintentar.'},{status:error instanceof WorkspaceError?error.status:503});}
}
