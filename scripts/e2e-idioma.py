# Idioma (publicación 1): el Cerebro responde en el idioma del pedido y escribe en las fichas en el idioma de trabajo.
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
    res.append(bool(cond)); print(('OK   ' if cond else 'FALLA'), name, ('· ' + str(info)[:240] if info != '' else ''))
C = '/api/agent/cerebro'
ask = lambda text, **kw: http(C, {'action': 'pedir', 'text': text, **kw.pop('extra', {})}, **kw)
node = lambda i: http('/api/agent/brain?node=' + i)[1].get('node') or {}
ES_WORDS = re.compile(r'\b(Hecho|Agenda del|Ficha de|Crear ficha|Anotar|Mover la tarea|Quitar de|Incluye|Quedó|No se cambió)\b')

http('/api/auth/setup', {'token': 'token-de-prueba-123456', 'email': 'hb@prueba.test', 'name': 'HB Prueba', 'password': 'Clave-de-prueba-2026'}, session=True)
s, d = http('/api/auth/login', {'email': 'hb@prueba.test', 'password': 'Clave-de-prueba-2026'}, session=True); check('entra la persona', s == 200, s)
s, tok = http('/api/auth/csrf', session=True); X = {'x-csrf-token': tok.get('token', '')}
P = lambda body: http(C, body, session=True, headers=X)
P({'action': 'ajustes', 'mode': 'auto'})
s, st = http(C); check('estado: workLang sin elegir = español', st['settings']['workLang'] == 'es' and st['settings']['workLangSet'] is False, st['settings'].get('workLang'))
s, st = http(C + '?uiLang=en', session=True); s, st = http(C, session=True); check('ver la pantalla en inglés no fija el idioma de trabajo', st['settings']['workLangSet'] is False)
s, st = http(C + '?lang=en'); check('GET ?lang=en: respuesta del estado en inglés', 'ask for a change in words' in st['how'] and st['lang'] == 'en', st.get('how'))
s, st = http(C); check('GET sin idioma: español', 'pedir un cambio en palabras' in st['how'] and st['lang'] == 'es')

# 1. Pedido en inglés con llave de agente: responde en inglés; las fichas siguen en el idioma de trabajo (español, aún sin elegir)
s, r = ask('Schedule a meeting with Richard to see the second brain tomorrow at 8')
check('inglés → respuesta en inglés (lang, mensaje, plan, resultados)', s == 200 and r['lang'] == 'en' and r['message'] == 'Done.' and r['plan'][0].startswith('Agenda: “') and 'on the agenda for 2026-11-13 at 08:00' in r['results'][0] and not ES_WORDS.search(json.dumps(r['plan'] + r['results'] + [r['message']])), (r.get('message'), r.get('plan'), r.get('results')))
check('…los enlaces salen en inglés', any(l['label'].startswith('Note of') or l['label'].startswith('Agenda for') for l in r.get('links', [])) and not any(l['label'].startswith('Ficha de') for l in r['links']), r.get('links'))
check('…y el título guardado sigue el idioma de TRABAJO (español)', any('Reunión con Richard' in e.get('title', '') for e in (lambda g: g.get('occurrences', g.get('events', [])))(http('/api/agent/agenda?from=2026-11-13&to=2026-11-13')[1])), '')
b = node('person-richard-bailey').get('body', ''); check('…y la bitácora en español (fuente/registró)', 'registró:' in b and 'logged by' not in b, b[-200:])

# 2. Pedido en español en el mismo cerebro: responde en español
s, r = ask('La reunión con MEDIMEX pasó al lunes 16 a las 3 pm; anótalo y crea tarea de enviar la propuesta el viernes.')
check('español → respuesta en español', s == 200 and r['lang'] == 'es' and r['message'] == 'Hecho.' and r['plan'][0].startswith('Anotar en'), (s, r.get('message'), r.get('plan')))

# 3. Persona con la pantalla en inglés, cerebro sin idioma elegido: se toma el de la pantalla y queda guardado
s, r = P({'action': 'pedir', 'text': 'move the Richard meeting to next week', 'uiLang': 'en'})
check('persona escribe en inglés: aplica y responde en inglés', s == 200 and r['status'] == 'aplicado' and r['lang'] == 'en' and 'moved from' in r['results'][0], (s, r.get('message'), r.get('results')))
s, st = http(C); check('…el idioma de trabajo del cerebro quedó en inglés (tomado de lo que escribió)', st['settings']['workLang'] == 'en' and st['settings']['workLangSet'] is True, st['settings'].get('workLang'))
b = node('person-richard-bailey').get('body', ''); check('…la bitácora nueva ya sale en inglés (logged by, source)', 'logged by:' in b and 'moved from' in b, b[:400])
evs = http('/api/agent/agenda?from=2026-11-17&to=2026-11-17')[1]; evs = evs.get('occurrences', evs.get('events', []))
check('…y el título de la reunión movida, en inglés', any(e.get('title', '').startswith('Meeting with Richard') for e in evs), [e.get('title') for e in evs])

# 4. Ficha nueva con idioma de trabajo inglés: encabezados en inglés
s, r = ask('create distributor Prueba E2E in Toronto, first contact by email')
n = node('dist-prueba-e2e'); check('ficha nueva: creada, con «## Log» y notas en inglés', s == 200 and r['status'] == 'aplicado' and '## Log' in n.get('body', '') and 'logged by:' in n['body'] and '## Bitácora' not in n['body'], (s, r.get('message'), n.get('body', '')[:300]))
s, r = ask('indicador: ventas Canadá 1250 cajas', extra={'lang': 'en'}); check('lang forzado «en» con texto en español → respuesta en inglés', s == 200 and r['lang'] == 'en' and r['results'][0].startswith('Indicator “'), (r.get('results'), r.get('lang')))
s, r = ask('indicador: ventas Canadá 1260 cajas', extra={'lang': 'es'}); check('lang forzado «es» → español', s == 200 and r['lang'] == 'es' and r['results'][0].startswith('Indicador «'), r.get('results'))
s, r = P({'action': 'pedir', 'text': 'Bren', 'uiLang': 'en'}); check('texto ambiguo («Bren»): manda la pantalla (inglés); la pregunta del modelo sale en inglés', s == 200 and r['status'] == 'pregunta' and r['lang'] == 'en' and 'Who is he' in r['message'], (r.get('lang'), r.get('message')))
s, d = P({'action': 'responder', 'id': r['id'], 'text': 'MEDIMEX', 'uiLang': 'es'}); check('responder con una palabra suelta: sigue el idioma del pedido (inglés)', s == 200 and d['lang'] == 'en' and d['status'] == 'aplicado' and 'created' in ' '.join(d['results']), (s, d.get('lang'), d.get('message'), d.get('results')))

# 5. Propuestas: «Por aprobar» y aprobación en inglés
P({'action': 'ajustes', 'mode': 'proponer'})
s, r = ask('move the MEDIMEX meeting to Wednesday'); check('modo proponer en inglés: el motivo sale en inglés', s == 202 and r['why'].startswith('Includes tasks and agenda') and 'propose' in r['why'], r.get('why'))
s, d = P({'action': 'aprobar', 'id': r['id'], 'uiLang': 'en'}); check('aprobar en inglés: resultados en inglés', s == 200 and d['request']['status'] == 'aplicado' and 'on the agenda for' in ' '.join(d['request']['results']) or 'moved from' in ' '.join(d['request']['results']), d.get('request', {}).get('results'))
s, ch = http('/api/agent/changes'); dump = json.dumps(ch); check('el diario dice «approved MANUALLY by» (idioma de trabajo inglés)', 'approved MANUALLY by' in dump, dump[:200])
s, r = ask('delete the ficha of Luisa'); check('borrar espera a una persona (motivo en inglés)', s == 202 and 'a person always approves' in r['why'], r.get('why'))
P({'action': 'ajustes', 'mode': 'auto'})
s, r = ask('indicator: sales Canada 99 boxes'); check('menú en inglés: nombre del indicador queda tal cual', s == 200 and r['lang'] == 'en', (s, r.get('message')))
s, r = ask('ambiguous: move it to Monday'); check('pregunta del modelo en inglés', s == 200 and r['status'] == 'pregunta' and r['message'] == 'Which distributor do you mean?', r.get('message'))

# 6. Errores de la app en inglés
s, r = ask('siempre-mal: note something'); check('error de plan inválido en inglés (422)', s == 422 and 'could not build a valid plan' in r['message'] and 'does not exist' in r['message'], r.get('message'))
h = node('dist-medimex')['hash']; s, r = ask('falla-al-aplicar: note and complete'); check('todo o nada, mensaje en inglés', s == 502 and 'Nothing was changed' in r['message'] and node('dist-medimex')['hash'] == h, r.get('message'))
s, d = http(C, {'action': 'aprobar', 'id': 'ped-no-existe', 'lang': 'en'}); check('error 404 en inglés', s == 404 and 'does not exist' in d['error'], d)
s, d = http(C, {'action': 'pedir', 'text': 'hi', 'lang': 'en'}); check('validación de entrada en inglés', s == 400 and 'Write the request' in d['error'], d)

# 7. Consultar en inglés y en español
s, d = http(C, {'action': 'consultar', 'q': 'What do we know about MEDIMEX?'})
miss = ' '.join(d.get('dossier', {}).get('missing', [])); check('consultar en inglés: respuesta del modelo en inglés y «lo que falta» en inglés', s == 200 and d['answer'].startswith('Answer written') and 'no está' not in miss and ('is not verified' in miss or 'There is' in miss or 'not loaded' in miss or not miss), (d.get('answer'), miss[:160]))
s, d = http(C, {'action': 'consultar', 'q': 'Qué sabemos de MEDIMEX'})
miss = ' '.join(d.get('dossier', {}).get('missing', [])); check('consultar en español: igual que antes', s == 200 and d['answer'].startswith('Respuesta redactada') and ('no está' in miss or 'No hay' in miss or not miss), (d.get('answer'), miss[:160]))

# 8. Ajuste del idioma de trabajo
s, d = P({'action': 'ajustes', 'workLang': 'fr'}); check('workLang inválido se rechaza', s == 400, d)
s, d = P({'action': 'ajustes', 'workLang': 'es'}); check('la persona vuelve el idioma de trabajo a español', s == 200 and d['settings']['workLang'] == 'es', d)
s, d = P({'action': 'ajustes', 'bigTouch': 11}); s2, st = http(C); check('guardar otro ajuste no cambia el idioma de trabajo', st['settings']['workLang'] == 'es' and st['settings']['bigTouch'] == 11)
s, d = http(C, {'action': 'ajustes', 'workLang': 'en'}); check('un agente no cambia ajustes (403, también en inglés)', s == 403, d)

print(f"\n{sum(res)}/{len(res)} pruebas")
sys.exit(0 if all(res) else 1)
