# Chat con el Cerebro (vuelta 33): un hilo por persona; consulta / pedido / charla; respuestas cortas.
# Mismo servidor y Ollama simulado que e2e-fase3.py (restart limpio antes de correr).
import json, urllib.request, sys, http.cookiejar, re
B = 'http://localhost:3979'
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
    res.append(bool(cond)); print(('OK   ' if cond else 'FALLA'), name, ('· ' + str(info)[:260] if info != '' else ''))
C = '/api/agent/cerebro'
http('/api/auth/setup', {'token': 'token-de-prueba-123456', 'email': 'hb@prueba.test', 'name': 'HB Prueba', 'password': 'Clave-de-prueba-2026'}, session=True)
s, d = http('/api/auth/login', {'email': 'hb@prueba.test', 'password': 'Clave-de-prueba-2026'}, session=True); check('entra la persona', s == 200, s)
s, tok = http('/api/auth/csrf', session=True); X = {'x-csrf-token': tok.get('token', '')}
P = lambda body, **kw: http(C, body, session=True, headers={**X, **kw.get('h', {})})
chat = lambda text, **kw: P({'action': 'chat', 'text': text, **kw})
thread = lambda: (lambda d: (d.get('chat', []), d.get('chatRequests', {})))(http(C, session=True)[1])
P({'action': 'ajustes', 'mode': 'auto'})

s, st = http(C, session=True); check('hilo vacío al empezar', s == 200 and st.get('chat') == [] and st.get('chatRequests') == {}, st.get('chat'))
# 1. consulta
s, r = chat('¿Qué sabemos de MEDIMEX?')
check('consulta: responde corto, sin cambiar nada', s == 200 and r['intent'] == 'consulta' and r['added'][1]['kind'] == 'answer' and r['added'][1]['text'].startswith('Respuesta redactada') and not r.get('request'), r)
check('…con las fuentes que usó', len(r['added'][1].get('sources', [])) > 0, r['added'][1].get('sources'))
# 2. charla
s, r = chat('hola'); check('charla: responde breve sin modelo ni cambios', r['intent'] == 'charla' and r['added'][1]['kind'] == 'talk' and len(r['added'][1]['text']) < 120, r)
# 3. pedido: aplica con recibo, en el hilo
s, r = chat('Schedule a meeting with Richard Bailey tomorrow at 8')
check('pedido en inglés: se aplica y responde en inglés', s == 200 and r['intent'] == 'pedido' and r['request']['status'] == 'aplicado' and r['added'][1]['kind'] == 'request' and r['added'][1]['lang'] == 'en', (r.get('intent'), r.get('request', {}).get('status'), r['added'][1].get('lang')))
rid = r['request']['id']
msgs, reqs = thread()
check('el hilo guarda los 6 mensajes, en orden', len(msgs) == 6 and [m['role'] for m in msgs] == ['user', 'brain'] * 3, [m['role'] for m in msgs])
check('…y trae el pedido para pintar el plan, con su cambio para deshacer', rid in reqs and reqs[rid].get('changeId'), list(reqs))
# 4. deshacer desde el hilo usa el tubo de siempre
s, d = http('/api/agent/changes', {'action': 'undo', 'changeId': reqs[rid]['changeId']}, session=True, headers=X); check('deshacer el cambio del chat', s == 200 and d.get('ok'), d)
# 5. el Cerebro pregunta y la siguiente respuesta de la persona va a esa pregunta
s, r = chat('pedido-llm ambiguo: muévelo al lunes'); check('pedido dudoso: el Cerebro pregunta dentro del hilo', r['request']['status'] == 'pregunta' and r['added'][1]['kind'] == 'request', r.get('request', {}).get('status'))
qid = r['request']['id']
s, r = chat('Es MEDIMEX, el jueves 19 a las 10'); check('la respuesta del usuario va a esa pregunta (mismo pedido)', r['request']['id'] == qid and len(r['request'].get('dialog', [])) >= 1, (r['request']['id'], qid))
s, r = chat('¿Qué sabemos de MEDIMEX?'); check('una pregunta nueva no se toma como respuesta a la pregunta abierta', r['intent'] == 'consulta' and r['added'][1]['kind'] == 'answer', (r['intent'], r['added'][1]['kind']))
# 6. consulta sin coincidencias: dice que no encontró, corto
s, r = chat('¿Qué sabemos de Zzzqqq Wwwxxx?'); check('sin coincidencias: lo dice y pide el nombre', r['added'][1]['kind'] == 'talk' and 'No encontré' in r['added'][1]['text'], r['added'][1])
s, r = chat('What do we know about MEDIMEX?'); check('consulta en inglés: responde en inglés', r['added'][1]['text'].startswith('Answer written') and r['added'][1]['lang'] == 'en', r['added'][1])
# 7. modo leer (correo pegado)
s, r = chat('Correo de Ana Ruiz de ticasur: piden lista de precios', mode='leer'); check('modo leer: pasa por el extractor', s == 200 and r['request'].get('kind') == 'leer', r.get('request', {}).get('kind'))
# 8. validaciones y límites
s, r = chat('x'); check('mensaje vacío o de una letra: 400', s == 400, r)
s, r = chat('a' * 60001); check('mensaje enorme: 413', s == 413, s)
s, r = http(C, {'action': 'chat', 'text': 'hola'}); check('un agente no usa el chat (403)', s == 403, r)
s, st = http(C); check('…y su estado no trae el hilo de nadie', 'chat' not in st, list(st)[:5])
for i in range(30): chat('gracias')
msgs, _ = thread(); check('el hilo guarda como mucho 50 mensajes', len(msgs) == 50, len(msgs))
# 9. nuevo hilo
s, d = P({'action': 'chat_reset'}); msgs, reqs = thread(); check('nuevo hilo: queda vacío', s == 200 and msgs == [] and reqs == {}, len(msgs))
# 10. el chat no escribe por otro camino: una consulta no cambia nada
s, j = http('/api/agent/changes'); n0 = len(j.get('changes', j.get('items', [])))
chat('¿Qué sabemos de MEDIMEX?'); s, j = http('/api/agent/changes'); check('una consulta no deja cambios en el diario', len(j.get('changes', j.get('items', []))) == n0, (n0, len(j.get('changes', j.get('items', [])))))
print(f"\n{sum(res)}/{len(res)} pruebas")
sys.exit(0 if all(res) else 1)
