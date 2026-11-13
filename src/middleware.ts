import { publicHbPath } from '@/lib/publicHbRoutes';
import { externalRouteBlocked } from '@/lib/runtimePolicy';
import { NextResponse, NextRequest } from 'next/server';
import { validEdgeSession, edgeSessionPayload } from '@/lib/sessionPayload';
import { gateDecision, loginRequiredFrom, serviceKeyMatches, ownBrainDecision, agentKeyPresented, retiredPage } from '@/lib/loginGate';
// El middleware corre en el borde (sin async_hooks): lee el idioma de la petición directamente.
const wantsEn = (r: NextRequest) => (r.headers.get('x-lang') || r.nextUrl.searchParams.get('lang') || r.cookies.get('cerebro_lang')?.value) === 'en';
export async function middleware(request: NextRequest) {
  const en = wantsEn(request);
  const path = request.nextUrl.pathname;
  if (externalRouteBlocked(path, { TASKMANAGER_LOCAL_ONLY: process.env.TASKMANAGER_LOCAL_ONLY, TASKMANAGER_EXTERNAL_ACTIONS_ENABLED: process.env.TASKMANAGER_EXTERNAL_ACTIONS_ENABLED })) return NextResponse.json({ error: en ? 'External action disabled in this installation.' : 'Acción externa deshabilitada en esta instalación.' }, { status: 503 });
  // Cuentas con cerebro propio: confinadas a su Cerebro, haya o no login obligatorio.
  const payload = await edgeSessionPayload(request.cookies.get('hermes_session')?.value || '', process.env.SESSION_SECRET);
  const own = ownBrainDecision(path, payload?.brain);
  if (own === 'deny') return NextResponse.json({ error: en ? 'This section is not yet available for your brain.' : 'Esta sección todavía no está disponible para tu cerebro.' }, { status: 403 });
  if (own === 'redirect') return NextResponse.redirect(new URL('/inicio', request.url));
  if (typeof payload?.userId === 'string' && payload.userId.startsWith('local-') && retiredPage(path)) return NextResponse.redirect(new URL('/inicio', request.url));
  const loginRequired = loginRequiredFrom(process.env.LOGIN_REQUIRED);
  if (loginRequired) {
    const sessionValid = await validEdgeSession(request.cookies.get('hermes_session')?.value || '', process.env.SESSION_SECRET);
    const decision = gateDecision({ path, loginRequired, sessionValid, serviceKeyValid: serviceKeyMatches(request.headers, process.env.AGENT_API_KEY), agentKeyPresented: agentKeyPresented(request.headers) });
    if (decision === 'deny') return NextResponse.json({ error: en ? 'Sign in to continue.' : 'Inicia sesión para continuar.' }, { status: 401 });
    if (decision === 'login') { const url = new URL('/login', request.url); return NextResponse.redirect(url); }
  }
  if (!loginRequired && publicHbPath(path) && ['GET','HEAD'].includes(request.method)) return NextResponse.next();
  if (path.startsWith('/api/')) return NextResponse.next(); // Routes validate active users and permissions.
  const valid = await validEdgeSession(request.cookies.get('hermes_session')?.value || '', process.env.SESSION_SECRET);
  if (path === '/login' && request.nextUrl.searchParams.get('expired') === '1') { const response = NextResponse.next(); response.cookies.delete('hermes_session'); return response; }
  if (path === '/login') return valid ? NextResponse.redirect(new URL('/', request.url)) : NextResponse.next();
  if (path === '/setup') return NextResponse.next();
  if (!valid) return NextResponse.redirect(new URL('/login', request.url));
  return NextResponse.next();
}
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|avatars|brands|smj-verified).*)'] };
