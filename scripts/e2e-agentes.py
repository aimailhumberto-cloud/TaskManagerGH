# Regla de los agentes (vuelta 34): toda llave de agente lee todo y escribe SOLO pidiéndoselo al Cerebro.
# Servidor como e2e-fase3.py, pero con WRITE_MODE=regla (sin AGENT_WRITE_MODE=legacy). Con el argumento «legacy», prueba la salida de emergencia.
import json, urllib.request, sys, http.cookiejar, re
B = 'http://localhost:3979'; LEGACY = len(sys.argv) > 1 and sys.argv[1] == 'legacy'
jar = http.cookiejar.CookieJar(); opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
def http(path, body=None, key='k-prueba-123', session=False, headers=None):
    h = {'Content-Type': 'application/json', 'Origin': B, **(headers or {})}
    if not session and key: h['x-agent-key'] = key
    if session and len(jar): h['Cookie'] = '; '.join(f'{c.name}={c.value}' for c in jar)
    req = urllib.request.Request(B + path, data=json.dumps(body).encode() if body is not None else None, headers=h, method='POST' if body is not None else 'GET')
    try:
        with (opener.open(req) if session else urllib.request.urlopen(req)) as r: return r.status, json.loads(r.read().decode() or '{}')
    except urllib.error.HTTPError as e:
        try: return e.code, json.loads(e.read().decode() or '{}')
        except Exception: return e.code, {}
res = []
def check(name, cond, info=''):
    res.append(bool(cond)); print(('OK   ' if cond else 'FALLA'), name, ('· ' + str(info)[:240] if info != '' else ''))
http('/api/auth/setup', {'token': 'token-de-prueba-123456', 'email': 'hb@prueba.test', 'name': 'HB Prueba', 'password': 'Clave-de-prueba-2026'}, session=True)
s, d = http('/api/auth/login', {'email': 'hb@prueba.test', 'password': 'Clave-de-prueba-2026'}, session=True); check('entra la persona', s == 200, s)
s, tok = http('/api/auth/csrf', session=True); X = {'x-csrf-token': tok.get('token', '')}
C = '/api/agent/cerebro'
P = lambda path, body: http(path, body, session=True, headers=X)
P(C, {'action': 'ajustes', 'mode': 'auto', 'agentCanApprove': True})

DOORS = [
  ('vault-sync', {'action': 'write_file', 'path': '00-Working-Memory/Directo.md', 'content': '---\ntype: working_memory\n---\nx'}),
  ('brain', {'action': 'remember_working', 'title': 'Directo', 'content': 'x'}),
  ('brain', {'action': 'upsert_node', 'relativePath': 'Directo.md', 'frontmatter': {'id': 'directo', 'type': 'person', 'title': 'Directo'}}),
  ('hub', {'action': 'brain_dump', 'text': 'hacer algo directo'}),
  ('tasks', {'action': 'create', 'title': 'Directa'}),
  ('kpis', {'action': 'set', 'name': 'Directo', 'value': 1}),
  ('agenda', {'action': 'set', 'title': 'Directa', 'date': '2026-11-20'}),
  ('assets', {'action': 'assign', 'nodeId': 'dist-medimex'}),
  ('shared', {'action': 'set_visibility', 'path': 'x', 'visibility': 'public'}),
  ('changes', {'action': 'undo', 'changeId': 'no-importa'}),
  ('dots-sleep', {'action': 'decide', 'id': 'x', 'decision': 'aprobar'}),
  ('decisions', {'action': 'ping'}),
]
if LEGACY:
    s, d = http('/api/agent/kpis', {'action': 'set', 'name': 'Salida de emergencia', 'value': 5}); check('salida de emergencia: la llave general vuelve a escribir directo', s == 200 and d.get('ok'), (s, d))
    s, d = http('/api/agent/vault-sync', {'action': 'write_file', 'path': '00-Working-Memory/Emergencia.md', 'content': '---\ntype: working_memory\nid: emergencia\n---\nx'}); check('…también por vault-sync', s == 200, (s, d))
    print(f"\n{sum(res)}/{len(res)} pruebas"); sys.exit(0 if all(res) else 1)

# 1. Lecturas abiertas
for p in ['/api/agent/dashboard', '/api/agent/brief', '/api/agent/vault-sync?list=1', '/api/agent/kpis', '/api/agent/agenda', '/api/agent/search?q=medimex', '/api/agent/dossier?q=medimex']:
    s, d = http(p); check('lee: ' + p.split('?')[0], s == 200, s)
# 2. Todas las puertas directas cerradas, con la salida clara
for door, body in DOORS:
    s, d = http('/api/agent/' + door, body)
    check(f'cerrada: {door} · {body["action"]}', s == 403 and d.get('blocked') is True and 'cerebro' in json.dumps(d.get('how', '')).lower(), (s, str(d)[:120]))
s, d = http('/api/agent/kpis', {'action': 'set', 'name': 'Directo', 'value': 1}, headers={'x-lang': 'en'}); check('el bloqueo habla inglés si se pide', s == 403 and 'Agent keys can only ask' in d.get('error', ''), d.get('error'))
s, d = http(C, {'action': 'ajustes', 'mode': 'auto'}); check('el agente no cambia ajustes', s == 403, s)
s, d = http(C, {'action': 'chat', 'text': 'hola'}); check('el agente no usa el chat de personas', s == 403, s)
s, d = http(C, {'action': 'revisado', 'id': 'x'}); check('el agente no cierra pendientes de calidad', s == 403 and d.get('blocked'), s)
s, d = http('/api/agent/vault-sync?path=00-Working-Memory/Directo.md'); check('lo bloqueado no escribió nada', s == 404 or not d.get('content'), s)
s, d = http('/api/agent/kpis'); check('…ni indicadores', not any(k['name'] == 'Directo' for k in d.get('kpis', [])), s)
# 3. Pedir y consultar siguen abiertos
s, d = http(C, {'action': 'consultar', 'q': 'Qué sabemos de MEDIMEX'}); check('consultar: abierto', s == 200 and d.get('ok'), s)
s, r = http(C, {'action': 'pedir', 'text': 'Crea una tarea para hoy: revisar el pedido de MEDIMEX'}) if False else http(C, {'action': 'pedir', 'text': 'Schedule a meeting with Richard tomorrow at 8'}); check('pedir: abierto y el Cerebro escribe (aplicado)', s == 200 and r['status'] == 'aplicado', (s, r.get('status'), r.get('message')))
cid = r.get('changeId'); check('…con recibo y deshacer en el diario, a nombre del Cerebro', bool(cid), r.get('changeId'))
s, d = P(C, {'action': 'ajustes', 'mode': 'proponer'}); s, r = http(C, {'action': 'pedir', 'text': 'move the MEDIMEX meeting to Wednesday'}); check('pedir en modo proponer: queda por aprobar', s == 202 and r['status'] == 'pendiente', (s, r.get('status')))
s, d = http(C, {'action': 'aprobar', 'id': r['id']}); check('aprobar por el agente (permitido en Ajustes): no se bloquea', s == 200 and d.get('ok'), (s, str(d)[:100]))
s, r2 = http(C, {'action': 'pedir', 'text': 'move the MEDIMEX meeting to Friday'}); s, d = http(C, {'action': 'rechazar', 'id': r2['id']}); check('rechazar por el agente: abierto', s == 200, s)
s, r3 = http(C, {'action': 'pedir', 'text': 'ambiguo: muévelo al lunes'}); s, d = http(C, {'action': 'responder', 'id': r3['id'], 'text': 'Es MEDIMEX'}); check('responder una pregunta del Cerebro: abierto', s in (200, 202, 409) and not d.get('blocked'), (s, str(d)[:100]))
s, d = http(C, {'action': 'leer', 'text': 'Correo de Ana Ruiz de ticasur: piden lista de precios'}); check('leer un correo: abierto', s in (200, 202) and not d.get('blocked'), s)
# 4. Llaves por agente
s, k = P('/api/keys', {'action': 'create', 'name': 'DOTS-prueba', 'scope': 'cerebro'}); check('se crea llave «cerebro»', s in (200, 201) and k.get('key', '').startswith('tmk_'), (s, str(k)[:80]))
s, bad = P('/api/keys', {'action': 'create', 'name': 'Vieja', 'scope': 'escribir'}); check('el alcance «escribir» ya no se ofrece (400)', s == 400, s)
KEY = k.get('key', '')
s, d = http('/api/agent/kpis', {'action': 'set', 'name': 'Directo', 'value': 1}, key=KEY); check('llave «cerebro»: no escribe directo', s == 403 and d.get('blocked'), (s, d))
s, d = http(C, {'action': 'consultar', 'q': 'Qué sabemos de MEDIMEX'}, key=KEY); check('llave «cerebro»: consulta', s == 200, s)
s, d = http('/api/agent/kpis', key=KEY); check('llave «cerebro»: lee', s == 200, s)
s, d = http(C, {'action': 'pedir', 'text': 'move the MEDIMEX meeting to Thursday'}, key=KEY); check('llave «cerebro»: pide', s in (200, 202) and d.get('status') in ('aplicado', 'pendiente'), (s, d.get('status')))
s, k2 = P('/api/keys', {'action': 'create', 'name': 'Solo-leer', 'scope': 'leer'}); s, d = http(C, {'action': 'pedir', 'text': 'hola cambia algo'}, key=k2.get('key', '')); check('llave «leer»: no escribe ni pide (403)', s == 403, s)
# 5. Lo que ve la persona
s, dash = http('/api/agent/dashboard', session=True); lg = dash.get('log', {})
check('Inicio cuenta los intentos directos bloqueados', lg.get('blocked', {}).get('count', 0) >= len(DOORS), lg.get('blocked', {}).get('count'))
check('…y dice por qué puerta intentó', any('vault-sync' in x['door'] for x in lg.get('blocked', {}).get('byDoor', [])), lg.get('blocked', {}).get('byDoor'))
check('…los bloqueos no se mezclan con lo que sí hizo el agente', not any(e.get('blocked') for e in lg.get('activity', [])), '')
s, ch = http('/api/agent/changes?limit=100'); ents = ch.get('entries', [])
check('el diario solo tiene cambios del Cerebro (nada directo del agente)', ents and not any(e.get('via') == 'llave' and e.get('route') != '/api/agent/cerebro' for e in ents), [(e.get('actor'), e.get('route')) for e in ents][:6])
s, d = P('/api/agent/kpis', {'action': 'set', 'name': 'De la persona', 'value': 3}); check('la persona sigue escribiendo normal en la app', s == 200 and d.get('ok'), s)
print(f"\n{sum(res)}/{len(res)} pruebas")
sys.exit(0 if all(res) else 1)
