// Pruebas de la copia de fotos a la biblioteca (sin red). Uso: npm run test:assets
import { fetchRemoteImage, isImportableUrl } from '../src/lib/assetStore';
let fails = 0; const ok = (c: boolean, m: string) => { console.log(c ? '  ok ' : 'FALLÓ', m); if (!c) fails++; };
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64, 1)]);
const res = (body: Buffer, o: { url?: string; status?: number; len?: number; loc?: string } = {}) => ({ ok: (o.status || 200) < 300, status: o.status || 200, url: o.url || '', headers: new Headers({ ...(o.len ? { 'content-length': String(o.len) } : {}), ...(o.loc ? { location: o.loc } : {}) }), arrayBuffer: async () => body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) }) as unknown as Response;
const fails_with = async (p: Promise<unknown>) => { try { await p; return ''; } catch (e) { return (e as Error).message; } };
(async () => {
  ok(isImportableUrl('https://cdn.shopify.com/s/files/1/x.png'), 'CDN de la tienda permitido');
  ok(isImportableUrl('https://shopsmj.com/cdn/shop/files/a.jpg?v=1'), 'tienda permitida');
  for (const bad of ['http://cdn.shopify.com/x.png', 'https://cdn.shopify.com.evil.com/x.png', 'https://evil.com/cdn.shopify.com/x.png', 'https://user@cdn.shopify.com/x.png', 'https://cdn.shopify.com:8443/x.png', 'https://127.0.0.1/x.png', 'https://169.254.169.254/latest', 'file:///etc/passwd', 'javascript:alert(1)', '', null, 42])
    ok(!isImportableUrl(bad as any), `rechaza ${String(bad).slice(0, 44)}`);
  const good = 'https://cdn.shopify.com/s/files/1/x.png';
  ok((await fetchRemoteImage(good, (async () => res(PNG, { url: good })) as any)).length === PNG.length, 'descarga una imagen válida');
  ok(/lista permitida/.test(await fails_with(fetchRemoteImage('https://evil.com/x.png', (async () => res(PNG)) as any))), 'no llama a sitios fuera de la lista');
  { const called: string[] = []; const f = (async (u: string) => { called.push(u); return res(PNG, { status: 302, loc: 'https://evil.com/x.png' }); }) as any;
    ok(/redirigió/.test(await fails_with(fetchRemoteImage(good, f))) && called.length === 1, 'rechaza redirección a otro sitio sin llamarlo'); }
  { let n = 0; const f = (async () => (n++ === 0 ? res(PNG, { status: 301, loc: '/s/files/1/y.png' }) : res(PNG))) as any;
    ok((await fetchRemoteImage(good, f)).length === PNG.length && n === 2, 'sigue una redirección dentro del mismo sitio'); }
  ok(/Demasiadas/.test(await fails_with(fetchRemoteImage(good, (async () => res(PNG, { status: 302, loc: good })) as any))), 'corta un ciclo de redirecciones');
  ok(/2 MB/.test(await fails_with(fetchRemoteImage(good, (async () => res(PNG, { url: good, len: 9e6 })) as any))), 'rechaza por tamaño declarado');
  ok(/2 MB/.test(await fails_with(fetchRemoteImage(good, (async () => res(Buffer.concat([PNG, Buffer.alloc(2.2e6)]), { url: good })) as any))), 'rechaza por tamaño real');
  ok(/no es una imagen/.test(await fails_with(fetchRemoteImage(good, (async () => res(Buffer.from('<html><script>'), { url: good })) as any))), 'rechaza lo que no es imagen');
  ok(/respondió 404/.test(await fails_with(fetchRemoteImage(good, (async () => res(PNG, { url: good, status: 404 })) as any))), 'informa un 404');
  ok(/No se pudo descargar/.test(await fails_with(fetchRemoteImage(good, (async () => { throw new Error('ECONNRESET'); }) as any))), 'informa un fallo de red');
  console.log(fails ? `${fails} fallas` : 'assets: todo ok'); process.exit(fails ? 1 : 0);
})();
