import { hasAdministrationCapability } from '@/lib/capabilities';
import {dbService} from '@/services/dbService';
import {whatsappOwnerAllowed} from '@/lib/whatsappOwner';
import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/auth';
import { readWhatsAppStatus } from '@/lib/whatsappStatus';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export async function GET(request: NextRequest) {
  const auth = await validateApiKey(request);
  if (!auth.valid) return NextResponse.json({ error: auth.error }, { status: auth.status, headers: { 'Cache-Control': 'no-store' } });
  if (!auth.session || !hasAdministrationCapability(auth.session.role)) return NextResponse.json({ error: 'Panel reservado al administrador.' }, { status: 403 });
  try { if(!whatsappOwnerAllowed(auth.session,await dbService.readData()))return NextResponse.json({error:'Panel reservado al propietario verificado.'},{status:403}); } catch { return NextResponse.json({error:'No se pudo verificar propietario.'},{status:503}); }
  return NextResponse.json(await readWhatsAppStatus(process.env.TASKMANAGER_LOCAL_ONLY === '1' ? process.env.TASKMANAGER_WHATSAPP_DIRECTORY : undefined), { headers: { 'Cache-Control': 'no-store' } });
}
