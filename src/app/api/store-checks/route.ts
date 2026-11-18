import { NextRequest, NextResponse } from 'next/server';
import { sameRequestOrigin } from '@/lib/auth';
import { cleanVisit, summarize, toCsv } from '@/lib/storeCheck';
import { StoreCheckError, deleteVisit, getCatalog, getVisit, listVisits, saveCatalog, saveVisit } from '@/lib/storeCheckStore';
import { canEdit, who } from './auth';
export const dynamic = 'force-dynamic';

const fail = (e: unknown) => e instanceof StoreCheckError
  ? NextResponse.json({ error: e.message }, { status: e.status })
  : (console.error('store-checks', e), NextResponse.json({ error: 'No se pudo completar.' }, { status: 500 }));
const noSession = () => NextResponse.json({ error: 'Inicia sesión para continuar.' }, { status: 401 });

/** GET: lista (con resumen) · ?id= una visita · ?csv=1 exportar · ?catalog=1 solo el catálogo. */
export async function GET(request: NextRequest) {
  const w = who(request); if (!w) return noSession();
  try {
    const q = request.nextUrl.searchParams;
    const catalog = getCatalog();
    if (q.get('catalog')) return NextResponse.json({ catalog });
    const id = q.get('id');
    if (id) {
      const v = getVisit(id); if (!v) return NextResponse.json({ error: 'Visita no encontrada.' }, { status: 404 });
      return NextResponse.json({ visit: v, summary: summarize(v, catalog), canEdit: canEdit(w, v.by), catalog });
    }
    const visits = listVisits();
    if (q.get('csv')) {
      return new NextResponse(toCsv(visits), { headers: { 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': `attachment; filename="store-checks-${new Date().toISOString().slice(0, 10)}.csv"`, 'Cache-Control': 'no-store' } });
    }
    return NextResponse.json({
      me: { id: w.id, name: w.name, canWrite: w.canWrite, manager: w.manager }, catalog,
      visits: visits.map(v => ({ id: v.id, status: v.status, checkIn: v.checkIn, checkOut: v.checkOut, by: v.by, store: v.store, score: v.score, photosPending: v.photosPending, summary: summarize(v, catalog) })),
    });
  } catch (e) { return fail(e); }
}

/** POST {action:'save', visit} · {action:'delete', id} · {action:'catalog', catalog} */
export async function POST(request: NextRequest) {
  const w = who(request); if (!w) return noSession();
  if (!sameRequestOrigin(request)) return NextResponse.json({ error: 'Origen de la solicitud no permitido.' }, { status: 403 });
  if (!w.canWrite) return NextResponse.json({ error: 'Tu perfil es de solo lectura.' }, { status: 403 });
  try {
    const b = await request.json().catch(() => null);
    if (b?.action === 'catalog') {
      if (!w.manager) return NextResponse.json({ error: 'Solo Owner, Admin o Gerente cambian el catálogo.' }, { status: 403 });
      return NextResponse.json({ ok: true, catalog: saveCatalog(b.catalog) });
    }
    if (b?.action === 'delete') {
      const v = getVisit(String(b.id || '')); if (!v) return NextResponse.json({ error: 'Visita no encontrada.' }, { status: 404 });
      if (!canEdit(w, v.by)) return NextResponse.json({ error: 'Solo quien hizo la visita (o gerencia) la puede borrar.' }, { status: 403 });
      deleteVisit(v.id); return NextResponse.json({ ok: true });
    }
    if (b?.action === 'save') {
      const prev = b.visit?.id ? getVisit(String(b.visit.id)) : null;
      if (prev && !canEdit(w, prev.by)) return NextResponse.json({ error: 'Solo quien hizo la visita (o gerencia) la puede cambiar.' }, { status: 403 });
      const v = saveVisit(cleanVisit(b.visit, prev, { id: w.id, name: w.name }));
      return NextResponse.json({ ok: true, visit: v, summary: summarize(v, getCatalog()) });
    }
    return NextResponse.json({ error: 'Acción no válida.' }, { status: 400 });
  } catch (e) { return fail(e); }
}
