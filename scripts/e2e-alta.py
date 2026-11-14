# Ensayo de alta de una segunda persona: su cerebro nace aparte, su agente solo ve el suyo, y nadie ve los casos del otro.
# Mismo servidor y Ollama simulado que e2e-motor.py (restart limpio antes de correr).
import json, urllib.request, urllib.error, http.cookiejar
B = 'http://localhost:3979'; C = '/api/agent/cerebro'
class Who:
    def __init__(s): s.jar = http.cookiejar.CookieJar(); s.op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(s.jar)); s.x = {}
    def call(s, path, body=None, key=None, method=None):
        h = {'Content-Type': 'application/json', 'Origin': B, **s.x}
        if len(s.jar): h['Cookie'] = '; '.join(f'{c.name}={c.value}' for c in s.jar)
        if key: h = {'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key}
        req = urllib.request.Request(B + path, data=json.dumps(body).encode() if body is not None else None, headers=h, method=method or ('POST' if body is not None else 'GET'))
        try:
            with (urllib.request.urlopen(req) if key else s.op.open(req)) as r: return r.status, json.loads(r.read().decode() or '{}')
        except urllib.error.HTTPError as e:
            try: return e.code, json.loads(e.read().decode() or '{}')
            except Exception: return e.code, {}
    def login(s, email, pw):
        st, d = s.call('/api/auth/login', {'email': email, 'password': pw}); _, t = s.call('/api/auth/csrf'); s.x = {'x-csrf-token': t.get('token', '')}; return st, d
res = []
def check(name, cond, info=''):
    res.append(bool(cond)); print(('OK   ' if cond else 'FALLA'), name, ('· ' + str(info)[:300] if info != '' else ''))
hb = Who(); hb.call('/api/auth/setup', {'token': 'token-de-prueba-123456', 'email': 'hb@prueba.test', 'name': 'HB Prueba', 'password': 'Clave-de-prueba-2026'})
s, _ = hb.login('hb@prueba.test', 'Clave-de-prueba-2026'); check('entra HB', s == 200, s)
hb.call(C, {'action': 'ajustes', 'mode': 'proponer'})
s, h1 = hb.call(C, {'action': 'pedir', 'text': 'tarea-parecida'}); check('HB deja un caso esperando en su cerebro', h1.get('status') == 'pendiente', h1.get('status'))
s, hn = hb.call('/api/agent/brain?view=lite&market=all&lens=all'); hb_nodes = len(hn.get('nodes', []))
# Alta
s, a = hb.call('/api/admin/users', {'email': 'tomas@prueba.test', 'name': 'Tomás Prueba', 'role': 'Miembro', 'password': 'Clave-inicial-2026'})
check('1. HB crea la cuenta de Tomás', s in (200, 201), (s, str(a)[:200]))
tm = Who(); s, d = tm.login('tomas@prueba.test', 'Clave-inicial-2026'); check('2. Tomás entra con la clave inicial', s == 200, (s, str(d)[:200]))
must = (d.get('user') or {}).get('mustChange')
s, d = tm.call('/api/auth/password', {'current': 'Clave-inicial-2026', 'next': 'Clave-de-tomas-2026'}); check('2b. cambia su clave en la primera entrada', s == 200 and must, (s, must, str(d)[:160]))
tm = Who(); s, d = tm.login('tomas@prueba.test', 'Clave-de-tomas-2026'); check('2c. entra con su clave nueva', s == 200, s)
# Su cerebro
s, tn = tm.call('/api/agent/brain?view=lite&market=all&lens=all'); t_nodes = len(tn.get('nodes', []))
check('3. su cerebro nace aparte y casi vacío (no trae las fichas de HB)', s == 200 and 0 < t_nodes < 10 and hb_nodes > 100, (s, t_nodes, hb_nodes))
s, tc = tm.call(C); check('3b. no ve los casos de HB', s == 200 and not tc.get('pending') and not tc.get('recent'), (s, len(tc.get('pending', [])), len(tc.get('recent', []))))
check('3c. el Cerebro está listo en su cerebro, con sus propios ajustes', tc.get('ready') and tc.get('settings', {}).get('mode') != 'proponer', (tc.get('ready'), tc.get('settings', {}).get('mode')))
s, e = tm.call(C, {'action': 'estado', 'id': h1['id']}); check('3d. no puede consultar un caso de HB (404)', s == 404, s)
s, e = tm.call(C, {'action': 'aprobar', 'id': h1['id']}); check('3e. ni aprobarlo', s in (403, 404), s)
# Primer pedido en un cerebro vacío
s, t1 = tm.call(C, {'action': 'pedir', 'text': 'indicador de ventas de la semana'}); check('4. su primer pedido funciona en un cerebro vacío', t1.get('status') in ('pendiente', 'aplicado'), (s, t1.get('status'), t1.get('message', '')[:200]))
s, t2 = tm.call(C, {'action': 'pedir', 'text': 'Agrega una reunión mañana con Richard Bailey'})
check('4b. si nombra a alguien que no existe en SU cerebro, no usa la ficha del cerebro de HB', 'person-richard-bailey' not in json.dumps(t2.get('ops', [])) or t2.get('status') in ('no_entendido', 'pregunta', 'sin_cambios'), (t2.get('status'), t2.get('message', '')[:220]))
# Su agente
s, k = tm.call('/api/keys', {'action': 'create', 'name': 'Agente de Tomás', 'scope': 'cerebro'}); key = k.get('key', '')
check('5. crea la llave de su agente', s in (200, 201) and key.startswith('tmk_'), (s, str(k)[:120]))
s, ag = tm.call(C + '?x=1', None, key=key); s2, an = tm.call('/api/agent/brain?view=lite&market=all&lens=all', None, key=key)
check('5b. su agente ve el cerebro de Tomás, no el de HB', s2 == 200 and len(an.get('nodes', [])) == t_nodes and h1['id'] not in json.dumps(ag), (s, s2, len(an.get('nodes', []))))
s, a1 = tm.call(C, {'action': 'pedir', 'text': 'indicador de visitas del mes'}, key=key); check('5c. su agente pide y abre un caso en el cerebro de Tomás', a1.get('caso', {}).get('id') and a1.get('status') in ('pendiente', 'aplicado', 'pregunta'), (s, a1.get('status'), a1.get('message', '')[:160]))
s, a2 = tm.call(C, {'action': 'estado', 'id': h1['id']}, key=key); check('5d. su agente no puede ver un caso de HB', s == 404, s)
s, a3 = tm.call('/api/agent/brain?view=lite', None, key=key + 'x'); check('5e. una llave alterada no entra', s in (401, 403), s)
# HB no ve lo de Tomás
s, hc = hb.call(C); ids = json.dumps([r['id'] for r in hc.get('pending', []) + hc.get('recent', [])])
check('6. HB no ve los casos de Tomás ni de su agente', t1['id'] not in ids and a1.get('id', 'x') not in ids, ids[:200])
s, hn2 = hb.call('/api/agent/brain?view=lite&market=all&lens=all'); check('6b. el cerebro de HB quedó igual', len(hn2.get('nodes', [])) == hb_nodes, (len(hn2.get('nodes', [])), hb_nodes))
print(f"\n{sum(res)}/{len(res)} pruebas"); raise SystemExit(0 if all(res) else 1)
