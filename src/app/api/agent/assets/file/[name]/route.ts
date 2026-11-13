import fs from 'node:fs';
import { NextRequest, NextResponse } from 'next/server';
import { assetFilePath } from '@/lib/assetStore';
export const dynamic = 'force-dynamic';

/** Sirve una imagen subida a la biblioteca. Pasa por el mismo control de acceso que el resto de la app. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const f = assetFilePath(name);
  if (!f) return NextResponse.json({ ok: false, error: 'No existe.' }, { status: 404 });
  return new NextResponse(new Uint8Array(fs.readFileSync(f.path)), { headers: { 'Content-Type': f.mime, 'Cache-Control': 'private, max-age=86400', 'X-Content-Type-Options': 'nosniff' } });
}
