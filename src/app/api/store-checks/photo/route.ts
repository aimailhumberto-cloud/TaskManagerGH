import { NextRequest, NextResponse } from 'next/server';
import { sameRequestOrigin } from '@/lib/auth';
import { StoreCheckError, addPhoto, getVisit, readPhoto, removePhoto, MAX_PHOTO_BYTES } from '@/lib/storeCheckStore';
import { canEdit, who } from '../auth';
export const dynamic = 'force-dynamic';

const fail = (e: unknown) => e instanceof StoreCheckError
  ? NextResponse.json({ error: e.message }, { status: e.status })
  : (console.error('store-checks/photo', e), NextResponse.json({ error: 'No se pudo completar.' }, { status: 500 }));

/** GET ?visit=&id= devuelve la foto. */
export async function GET(request: NextRequest) {
  if (!who(request)) return NextResponse.json({ error: 'Inicia sesión para continuar.' }, { status: 401 });
  const q = request.nextUrl.searchParams;
  const p = readPhoto(String(q.get('visit') || ''), String(q.get('id') || ''));
  if (!p) return NextResponse.json({ error: 'Foto no encontrada.' }, { status: 404 });
  return new NextResponse(new Uint8Array(p.buf), { headers: { 'Content-Type': p.mime, 'Cache-Control': 'private, max-age=86400', 'X-Content-Type-Options': 'nosniff' } });
}

/** POST multipart: visit, file, tag, productId, caption · POST json {action:'delete', visit, id} */
export async function POST(request: NextRequest) {
  const w = who(request); if (!w) return NextResponse.json({ error: 'Inicia sesión para continuar.' }, { status: 401 });
  if (!sameRequestOrigin(request)) return NextResponse.json({ error: 'Origen de la solicitud no permitido.' }, { status: 403 });
  try {
    if ((request.headers.get('content-type') || '').includes('application/json')) {
      const b = await request.json().catch(() => null);
      const v = getVisit(String(b?.visit || '')); if (!v) return NextResponse.json({ error: 'Visita no encontrada.' }, { status: 404 });
      if (!canEdit(w, v.by)) return NextResponse.json({ error: 'No puedes cambiar esta visita.' }, { status: 403 });
      if (b?.action !== 'delete') return NextResponse.json({ error: 'Acción no válida.' }, { status: 400 });
      return NextResponse.json({ ok: true, visit: removePhoto(v.id, String(b.id || '')) });
    }
    if (Number(request.headers.get('content-length') || 0) > MAX_PHOTO_BYTES + 64 * 1024) return NextResponse.json({ error: 'La foto pasa de 10 MB.' }, { status: 413 });
    const form = await request.formData();
    const v = getVisit(String(form.get('visit') || '')); if (!v) return NextResponse.json({ error: 'Primero guarda la visita.' }, { status: 404 });
    if (!canEdit(w, v.by)) return NextResponse.json({ error: 'No puedes cambiar esta visita.' }, { status: 403 });
    const file = form.get('file');
    if (!file || typeof file === 'string') return NextResponse.json({ error: 'Falta la foto.' }, { status: 400 });
    if (file.size > MAX_PHOTO_BYTES) return NextResponse.json({ error: 'La foto pasa de 10 MB.' }, { status: 413 });
    const out = addPhoto(v.id, Buffer.from(await file.arrayBuffer()), { tag: String(form.get('tag') || ''), productId: String(form.get('productId') || ''), caption: String(form.get('caption') || '') });
    return NextResponse.json({ ok: true, photo: out.photo, visit: out.visit }, { status: 201 });
  } catch (e) { return fail(e); }
}
