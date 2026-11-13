// Arma el catálogo de imágenes de marca: public/brands/catalog.json y miniaturas en public/brands/thumbs/.
// Uso: node scripts/build-asset-catalog.mjs
import fs from 'node:fs'; import path from 'node:path'; import sharp from 'sharp';
const DIR = 'public/brands', THUMBS = path.join(DIR, 'thumbs');
fs.mkdirSync(THUMBS, { recursive: true });
const BRANDS = [['kool-kidz', /kool[-_ ]?kidz/], ['caribbean-cool', /caribbean[-_ ]?cool/], ['cole-cold', /cole[-_ ]?cold/], ['island-fusion', /island[-_ ]?fusion/], ['trinidad-juices', /trinidad[-_ ]?juices/], ['juciful', /juciful/], ['frutopia', /frutopia/], ['chubby', /chubby/], ['busta', /busta/], ['fruta', /fruta/], ['oasis', /oasis/], ['altitude', /altitude/], ['classic', /classic/], ['freshh', /freshh/], ['turbo', /turbo/], ['viva', /viva/], ['medimex', /medimex/], ['smjaleel', /smj|jaleel|quality-beverages|brands-you-love|manufacturing|plant|shop-brand|founder|mohammed|long-service/]];
const slug = s => s.toLowerCase().replace(/\.[a-z]+$/, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const kindOf = n => /logo/.test(n) ? 'logo' : /tile/.test(n) ? 'tile' : /hero|brands-you-love|quality-beverages|homepage-ad|whatsapp|shopsmj/.test(n) ? 'banner' : /-copy(-\d)?\.jpe?g$/.test(n) ? 'tile' : /founder|mohammed|long-service/.test(n) ? 'people' : /manufacturing|plant/.test(n) ? 'plant' : /hero|brands-you-love|quality-beverages|homepage-ad|whatsapp|shopsmj/.test(n) ? 'banner' : /bottles|can|home_|_0\d\d|ml|case|-copy/.test(n) ? 'product' : 'logo';
const out = [];
for (const f of fs.readdirSync(DIR).sort()) {
  if (!/\.(png|jpe?g|webp)$/i.test(f)) continue;
  const n = f.toLowerCase(), id = slug(f), src = path.join(DIR, f);
  const meta = await sharp(src).metadata();
  // Los logos apaisados se muestran completos sobre blanco; el resto se recorta al centro de interés.
  const wide = /logo/.test(n) && meta.width / meta.height > 1.3;
  await sharp(src).resize(192, 192, wide ? { fit: 'contain', background: '#ffffff' } : { fit: 'cover', position: 'attention' }).flatten(wide ? { background: '#ffffff' } : false).webp({ quality: 82 }).toFile(path.join(THUMBS, id + '.webp'));
  out.push({ id, url: '/brands/' + encodeURIComponent(f), thumb: '/brands/thumbs/' + id + '.webp', brand: (BRANDS.find(([, re]) => re.test(n)) || ['otros'])[0], kind: kindOf(n), w: meta.width, h: meta.height, bytes: fs.statSync(src).size });
}
fs.writeFileSync(path.join(DIR, 'catalog.json'), JSON.stringify(out));
const by = k => Object.entries(out.reduce((m, a) => (m[a[k]] = (m[a[k]] || 0) + 1, m), {})).sort((a, b) => b[1] - a[1]).map(([x, n]) => `${x}:${n}`).join(' ');
console.log(out.length, 'assets'); console.log(by('brand')); console.log(by('kind'));
