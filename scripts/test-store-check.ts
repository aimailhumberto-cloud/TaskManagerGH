/**
 * Store check: limpieza de visitas, resumen, exportar y guardado (visitas, fotos, catálogo) en carpeta temporal.
 * No toca el vault. Uso: npx tsx scripts/test-store-check.ts
 */
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

let ok = 0, bad = 0;
const t = (n: string, c: boolean, extra = '') => { c ? ok++ : (bad++, console.log('✗', n, extra)); };

async function main() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'storecheck-'));
  process.env.STORE_CHECKS_DIR = path.join(root, 'sc'); process.chdir(root);
  const S = await import('../src/lib/storeCheck');
  const D = await import('../src/lib/storeCheckStore');
  const by = { id: 'local-1', name: 'HB' };

  // A. Limpieza
  const raw = {
    id: '../../etc', status: 'cerrada', store: { name: '  Riba Smith  ', country: 'Panamá', chain: 'Riba' }, location: { lat: '8.982412', lng: -79.519934, accuracy: 12 },
    products: [
      { productId: 'busta', name: 'Busta', presence: 'si', place: 'gondola', position: '1', facings: '6', price: '1,25', promo: 'si', promoDetail: '2x1', inCold: true, flavorsFound: ['Cola', '', 'Uva'] },
      { productId: 'oasis', name: 'Oasis', presence: 'no' },
      { productId: 'fruta', name: 'Fruta', presence: 'agotado', place: 'inventado', facings: -3 },
      { name: '' },
    ],
    competitors: [{ brand: 'Coca-Cola', price: 'abc', promo: false }, { brand: '' }],
    cold: { has: true, owner: 'nuestro', foreignInOurs: true, working: false },
    secondary: { has: true, where: ['caja', 'hackeo'] }, score: 9, photos: [{ id: 'x', file: '../../secret' }],
  };
  const v = S.cleanVisit(raw, null, by);
  t('A1 un id raro no se usa (se crea uno nuevo)', S.isId(v.id) && !v.id.includes('.'));
  t('A2 limpia el nombre y la ubicación', v.store.name === 'Riba Smith' && v.location?.lat === 8.982412 && v.location?.lng === -79.519934);
  t('A3 cifras con coma y negativos', v.products[0].price === 1.25 && v.products[0].facings === 6 && v.products[2].facings === null);
  t('A4 opciones fuera de lista quedan vacías', v.products[2].place === '' && v.products[0].place === 'gondola');
  t('A5 sí/no se entienden', v.products[0].promo === true && v.products[0].inCold === true && v.products[1].promo === null);
  t('A6 se quitan productos y competencia vacíos', v.products.length === 3 && v.competitors.length === 1 && v.competitors[0].price === null);
  t('A7 segundo punto solo con lugares conocidos', v.secondary.where.join() === 'caja');
  t('A8 puntaje fuera de 1–5 se descarta', v.score === null);
  t('A9 las fotos nunca vienen del teléfono', v.photos.length === 0);
  t('A10 visita cerrada tiene salida', v.status === 'cerrada' && !!v.checkOut);
  t('A11 sabores vacíos se quitan', v.products[0].flavorsFound.join() === 'Cola,Uva');

  // B. Resumen
  const cat = { products: [{ id: 'busta', brand: 'Busta', name: 'Busta', category: '', flavors: [], suggestedPrice: 1.0, active: true }], competitors: [] };
  const s = S.summarize(v, cat);
  t('B1 cuenta presentes, faltantes y agotados', s.products === 3 && s.present === 1 && s.missing === 1 && s.outOfStock === 1);
  t('B2 primera posición, promo y frentes', s.firstPosition === 1 && s.withPromo === 1 && s.facings === 6);
  t('B3 avisa precio distinto al sugerido', s.offPrice === 1 && s.issues.some(i => /Precio distinto/.test(i)));
  t('B4 avisa frío nuestro con producto ajeno y sin funcionar', s.issues.some(i => /ajeno/.test(i)) && s.issues.some(i => /no funciona/.test(i)));

  // C. Guardado
  t('C1 sin catálogo guardado da el de las marcas', D.getCatalog().products.map(p => p.id).join() === 'busta,chubby,fruta,oasis,altitude');
  let err = ''; try { D.saveVisit({ ...v, store: { ...v.store, name: '' } }); } catch (e: any) { err = e.message; }
  t('C2 sin nombre de tienda no se guarda', /nombre de la tienda/.test(err));
  D.saveVisit(v);
  t('C3 se guarda y se lee', D.getVisit(v.id)?.store.name === 'Riba Smith' && D.listVisits().length === 1);
  t('C4 un id con ruta no lee nada', D.getVisit('../catalog') === null);
  const jpg = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff, 0xe0]), Buffer.alloc(100)]);
  const { photo } = D.addPhoto(v.id, jpg, { tag: 'frio', caption: 'frío' });
  t('C5 la foto se guarda en la visita', D.getVisit(v.id)!.photos.length === 1 && photo.tag === 'frio' && photo.file.endsWith('.jpg'));
  t('C6 la foto se lee', D.readPhoto(v.id, photo.id)?.mime === 'image/jpeg');
  err = ''; try { D.addPhoto(v.id, Buffer.from('<html>no soy foto</html>'), {}); } catch (e: any) { err = e.message; }
  t('C7 lo que no es foto se rechaza', /Solo fotos/.test(err));
  const again = S.cleanVisit({ ...v, notes: 'nueva nota', photos: [] }, D.getVisit(v.id), { id: 'otro', name: 'Otro' });
  t('C8 al editar se conservan fotos, autor y entrada', again.photos.length === 1 && again.by.id === 'local-1' && again.checkIn === v.checkIn && again.notes === 'nueva nota');
  D.removePhoto(v.id, photo.id);
  t('C9 borrar foto', D.getVisit(v.id)!.photos.length === 0 && D.readPhoto(v.id, photo.id) === null);
  const c = D.saveCatalog({ products: [{ brand: 'Busta', name: 'Busta Cola 2L', flavors: ['Cola'], suggestedPrice: '2,5' }, { brand: 'Busta', name: 'Busta Cola 2L' }], competitors: [{ brand: 'Coca-Cola', category: 'Refrescos' }] });
  t('C10 catálogo: ids únicos y precio', c.products.length === 2 && c.products[0].id !== c.products[1].id && c.products[0].suggestedPrice === 2.5 && D.getCatalog().competitors.length === 1);
  err = ''; try { D.saveCatalog({ products: [] }); } catch (e: any) { err = e.message; }
  t('C11 catálogo vacío no se guarda', /al menos un producto/.test(err));

  // D. Exportar
  const csv = S.toCsv(D.listVisits());
  const lines = csv.trim().split('\n');
  t('D1 una fila por producto revisado y por competencia', lines.length === 1 + 3 + 1, String(lines.length));
  t('D2 trae columnas clave', /tienda/.test(lines[0]) && /frentes/.test(lines[0]) && /precio/.test(lines[0]));
  t('D3 respeta comas y comillas', S.toCsv([{ ...v, store: { ...v.store, name: 'A, "B"' } }]).includes('"A, ""B"""'));

  D.deleteVisit(v.id);
  t('E1 borrar visita', D.listVisits().length === 0 && !fs.existsSync(path.join(root, 'sc', 'photos', v.id)));
  t('E2 nada se escribió en un vault', !fs.existsSync(path.join(root, 'vault')));

  console.log(`store-check: ${ok} bien, ${bad} mal`);
  process.exit(bad ? 1 : 0);
}
main().catch(e => { console.error(e); process.exit(1); });
