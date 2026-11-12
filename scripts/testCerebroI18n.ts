// Verifica que todo texto marcado con t("...") en el Cerebro tenga traducción al inglés,
// que ninguna traducción esté vacía y que el español sea el valor por defecto.
import { readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { EN, translate } from '../src/app/cerebro/i18n';

const dir = join(__dirname, '../src/app/cerebro');
const files = readdirSync(dir).filter((f) => /\.(tsx|ts)$/.test(f) && f !== 'i18n.ts');
let failed = 0;
const check = (name: string, ok: boolean, extra = '') => { console.log(`${ok ? '  ok' : 'FALLÓ'}  ${name}${extra ? ' ' + extra : ''}`); if (!ok) failed++; };

const used = new Set<string>();
for (const f of files) {
  const s = readFileSync(join(dir, f), 'utf8');
  for (const m of s.matchAll(/\bt\(("(?:[^"\\]|\\.)*")\)/g)) used.add(JSON.parse(m[1]));
  for (const m of s.matchAll(/\bt\('((?:[^'\\]|\\.)*)'\)/g)) used.add(m[1].replace(/\\'/g, "'"));
}
const missing = [...used].filter((k) => !(k in EN));
check(`${used.size} textos con t("...") tienen traducción`, missing.length === 0, missing.length ? JSON.stringify(missing) : '');
check('ninguna traducción está vacía', Object.values(EN).every((v) => v.trim().length > 0));
check('en español el texto queda igual', translate('es', 'Ajustes') === 'Ajustes');
check('en inglés se traduce', translate('en', 'Ajustes') === 'Settings');
check('un texto sin traducción cae al español', translate('en', 'texto inexistente 123') === 'texto inexistente 123');
if (failed) { console.log(`${failed} prueba(s) fallaron`); process.exit(1); }
console.log('pruebas de idioma pasaron');
