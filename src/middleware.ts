import { externalRouteBlocked } from '@/lib/runtimePolicy';
import { NextResponse, NextRequest } from 'next/server';
import { validEdgeSession } from '@/lib/sessionPayload';
export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (externalRouteBlocked(path, { TASKMANAGER_LOCAL_ONLY: process.env.TASKMANAGER_LOCAL_ONLY, TASKMANAGER_EXTERNAL_ACTIONS_ENABLED: process.env.TASKMANAGER_EXTERNAL_ACTIONS_ENABLED })) return NextResponse.json({ error: 'Acción externa deshabilitada en esta instalación.' }, { status: 503 });
  if (path.startsWith('/api/')) return NextResponse.next(); // Routes validate active users and permissions.
  const valid = await validEdgeSession(request.cookies.get('hermes_session')?.value || '', process.env.SESSION_SECRET);
  if (path === '/login' && request.nextUrl.searchParams.get('expired') === '1') { const response = NextResponse.next(); response.cookies.delete('hermes_session'); return response; }
  if (path === '/login') return valid ? NextResponse.redirect(new URL('/', request.url)) : NextResponse.next();
  if (!valid) return NextResponse.redirect(new URL('/login', request.url));
  return NextResponse.next();
}
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|avatars).*)'] };
