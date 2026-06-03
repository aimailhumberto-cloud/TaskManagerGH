import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Let public assets, API routes, and standard public paths pass
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/data') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.startsWith('/avatars')
  ) {
    return NextResponse.next();
  }

  const hasSession = request.cookies.has('hermes_session');

  // 2. If requesting the login page while having an active session, redirect to the main Dashboard
  if (pathname === '/login') {
    if (hasSession) {
      return NextResponse.redirect(new URL('/', request.url));
    }
    return NextResponse.next();
  }

  // 3. Redirect to login if no session is active
  if (!hasSession) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Protect all views, except login, API routes, and static assets
    '/((?!api|data|_next/static|_next/image|favicon.ico|avatars).*)',
  ],
};
