import { NextRequest, NextResponse } from 'next/server';
import { validateApiKey } from '@/lib/auth';
import { csrfToken } from '@/lib/csrf';
export const dynamic = 'force-dynamic';
export async function GET(request: NextRequest) {
  const auth = await validateApiKey(request);
  if (!auth.valid) return NextResponse.json({ error: auth.error }, { status: auth.status });
  return NextResponse.json({ token: csrfToken(request.cookies.get('hermes_session')!.value) }, { headers: { 'Cache-Control': 'no-store' } });
}
