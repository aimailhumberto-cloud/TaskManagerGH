import {NextRequest,NextResponse} from 'next/server';
import {PUBLIC_HB_CSRF_COOKIE,publicHbCsrf} from '@/lib/publicHbCsrf';
export const dynamic='force-dynamic';
export async function GET(request:NextRequest){
 try{const proof=publicHbCsrf(request.cookies.get(PUBLIC_HB_CSRF_COOKIE)?.value);const response=NextResponse.json({token:proof.token,scope:'public-hb-tasks'},{headers:{'Cache-Control':'no-store'}});response.cookies.set(PUBLIC_HB_CSRF_COOKIE,proof.cookie,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/api/public/workspace',maxAge:1800});return response;}
 catch{return NextResponse.json({error:'La protección de cambios no está disponible.'},{status:503});}
}
