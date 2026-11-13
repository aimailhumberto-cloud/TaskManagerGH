import { NextRequest, NextResponse } from 'next/server';
import { withBrain } from '@/lib/brains';
import { dossier, type DossierSize } from '@/lib/brainLens';
export const dynamic = 'force-dynamic';
/**
 * Expediente con contexto. ?q=Busta en Canadá  ó  ?node=dist-medimex,brand-busta  ·  &size=breve|normal|completo
 * Trae respuesta, contactos, último contacto, próximos pasos, agenda, cambios, cifras, archivos, «puede interesarte»,
 * «lo que falta» y la hora de los datos. Cada dato dice de qué ficha sale (from) y cuánto confiar (verification).
 */
async function _GET(req: NextRequest) {
  const sp = new URL(req.url).searchParams;
  const q = (sp.get('q') || '').slice(0, 300), nodes = (sp.get('node') || '').split(',').map(s => s.trim()).filter(Boolean).slice(0, 4);
  if (!q.trim() && !nodes.length) return NextResponse.json({ ok: false, error: 'Envía q (pregunta) o node (ids separados por coma).' }, { status: 400 });
  const size = (['breve', 'normal', 'completo'].includes(sp.get('size') || '') ? sp.get('size') : 'normal') as DossierSize;
  const d = dossier({ q: q || undefined, nodeIds: nodes.length ? nodes : undefined, size });
  return NextResponse.json(d, { status: d.ok ? 200 : 404 });
}
export const GET = withBrain(_GET);
