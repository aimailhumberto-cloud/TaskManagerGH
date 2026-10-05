import { NextResponse, NextRequest } from 'next/server';
import { validEdgeSession } from '@/lib/sessionPayload';
export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname;
  if (process.env.TASKMANAGER_LOCAL_ONLY === '1' && /^\/api\/(ai|telegram|agent|meetings|tasks\/share-email)(\/|$)/.test(path)) return NextResponse.json({ error: 'Integración externa deshabilitada en este preview.' }, { status: 503 });
  if (path.startsWith('/api/')) return NextResponse.next(); // Routes validate active users and permissions.
  const valid = await validEdgeSession(request.cookies.get('hermes_session')?.value || '', process.env.SESSION_SECRET);
  if (path === '/login' && request.nextUrl.searchParams.get('expired') === '1') { const response = NextResponse.next(); response.cookies.delete('hermes_session'); return response; }
  if (path === '/login') return valid ? NextResponse.redirect(new URL('/', request.url)) : NextResponse.next();
  if (!valid) return NextResponse.redirect(new URL('/login', request.url));
  return NextResponse.next();
}
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|avatars).*)'] };
