# Fase 2 (ojos): mapa, buscador, ficha con su entorno y expediente. Mismo servidor local que e2e-fase1.py.
import json, urllib.request, urllib.parse, sys, time
B = 'http://localhost:3979'
def get(path, key='k-prueba-123'):
    req = urllib.request.Request(B + path, headers={'x-agent-key': key})
    t = time.time()
    try:
        with urllib.request.urlopen(req) as r: return r.status, json.loads(r.read().decode()), time.time() - t
    except urllib.error.HTTPError as e: return e.code, {}, time.time() - t
q = lambda s: urllib.parse.quote(s)
res = []
def check(name, cond, info=''):
    res.append(bool(cond)); print(('OK   ' if cond else 'FALLA'), name, ('· ' + str(info) if info else ''))

s, m, t = get('/api/agent/map?catalog=0'); check('mapa sin catálogo, liviano', s == 200 and m['shown'] < m['total'] and len(json.dumps(m)) < 40000, f"{m.get('shown')} de {m.get('total')}, {len(json.dumps(m))} B")
check('mapa: una fila por ficha con padre y conexiones', len(m['nodes'][0]) == 7)
s, r, t = get('/api/agent/search?q=' + q('jenna')); check('buscar una persona', r['results'][0]['title'] == 'Jenna Hector', r['results'][0]['title'])
s, r, t = get('/api/agent/search?q=' + q('medimex panamá')); check('buscar sin acentos', r['results'][0]['id'] == 'dist-medimex', r['results'][0]['id'])
s, r, t = get('/api/agent/search?q=' + q('belice') + '&type=market'); check('sinónimo de país + filtro de tipo', r['results'] and r['results'][0]['id'] == 'market-belize', r['results'][0]['id'] if r['results'] else None)
s, c, t = get('/api/agent/brain?node=dist-medimex&context=1')
check('ficha con su entorno', c['node']['hash'] and len(c['pointsTo']) > 0 and len(c['mentionedBy']) > 0 and 'openTasks' in c)
check('sin campos de procedencia', not any(k.startswith('visual_') or k.endswith('_sha256') for k in c['node']['frontmatter']))
check('cada ficha relacionada una sola vez', len({x['id'] for x in c['mentionedBy']}) == len(c['mentionedBy']))
s, d, t = get('/api/agent/dossier?q=' + q('Busta en Canadá'))
check('expediente: entiende marca + mercado', [x['id'] for x in d['matched']] == ['brand-busta', 'market-canada'], [x['id'] for x in d['matched']])
check('expediente: distribuidores en el núcleo', {'dist-morgan-williams'} <= {x['id'] for x in d['core']}, [x['title'] for x in d['core']])
check('expediente: Jenna como contacto principal', d['contacts'][0]['name'] == 'Jenna Hector', d['contacts'][0]['name'])
check('expediente: avisa conexión que falta', any('Jenna Hector' in x for x in d['missing']))
check('expediente: todas las partes', all(k in d for k in ['answer', 'sources', 'contacts', 'lastContact', 'nextSteps', 'agenda', 'changes', 'figures', 'files', 'mayInterest', 'missing', 'dataAsOf']))
check('expediente: cada contacto dice de dónde sale', all('from' in x and 'verification' in x for x in d['contacts']))
check('expediente: rápido', t < 2, f'{t:.2f} s')
s, d, t = get('/api/agent/dossier?q=' + q('Chubby en Belice')); check('país → mercado', [x['id'] for x in d['matched']] == ['brand-chubby', 'market-belize'], [x['id'] for x in d['matched']])
s, d, t = get('/api/agent/dossier?q=' + q('distribuidores de Estados Unidos')); check('filtro por tipo', d['core'] and all(x['type'] == 'distributor' for x in d['core']), [x['title'] for x in d['core']])
s, d, t = get('/api/agent/dossier?q=' + q('Gabriela Trigueros') + '&size=breve'); check('persona: se trae a sí misma', d['contacts'][0]['name'] == 'Gabriela Trigueros' and d['size'] == 'breve')
s, d, t = get('/api/agent/dossier?q=xyzzy'); check('sin coincidencias: 404 claro', s == 404)
s, d, t = get('/api/agent/dossier?node=dist-medimex'); check('por id', d.get('matched', [{}])[0].get('id') == 'dist-medimex')
s, d, t = get('/api/agent/dossier?q=MEDIMEX', 'tmk_falsa_1'); check('llave falsa: 401', s == 401, s)
print(f'\n{sum(res)}/{len(res)} comprobaciones OK'); sys.exit(0 if all(res) else 1)
