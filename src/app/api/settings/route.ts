import {NextRequest,NextResponse} from 'next/server';
import {dbService} from '@/services/dbService';
import {validateApiKey} from '@/lib/auth';
export const dynamic='force-dynamic';
export async function GET(request:NextRequest){
 const auth=await validateApiKey(request);
 if(!auth.valid)return NextResponse.json({error:auth.error},{status:auth.status});
 try{
  const data=await dbService.readData();
  return NextResponse.json({smtpConfigured:!!data.smtpConfig?.host,aiConfigured:!!data.aiConfig?.endpoint},{headers:{'Cache-Control':'private, no-store'}});
 }catch{return NextResponse.json({error:'Configuración no disponible.'},{status:503});}
}
export async function POST(request:NextRequest){
 const auth=await validateApiKey(request);
 if(!auth.valid)return NextResponse.json({error:auth.error},{status:auth.status});
 return NextResponse.json({error:'La configuración de servicios se administra fuera de este flujo.'},{status:403});
}
