# Motor del Cerebro (vuelta 36): corregir sin duplicar, no inventar, no perder datos, informe claro.
# Mismo servidor y Ollama simulado que e2e-chat.py (restart limpio antes de correr, sin AGENT_WRITE_MODE=legacy o con él, da igual: usa sesión).
import json, urllib.request, http.cookiejar
B = 'http://localhost:3979'
jar = http.cookiejar.CookieJar(); opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
def http(path, body=None, session=True, headers=None):
    h = {'Content-Type': 'application/json', 'Origin': B, **(headers or {})}
    if len(jar): h['Cookie'] = '; '.join(f'{c.name}={c.value}' for c in jar)
    req = urllib.request.Request(B + path, data=json.dumps(body).encode() if body is not None else None, headers=h, method='POST' if body is not None else 'GET')
    try:
        with opener.open(req) as r: return r.status, json.loads(r.read().decode() or '{}')
    except urllib.error.HTTPError as e:
        try: return e.code, json.loads(e.read().decode() or '{}')
        except Exception: return e.code, {}
res = []
def check(name, cond, info=''):
    res.append(bool(cond)); print(('OK   ' if cond else 'FALLA'), name, ('· ' + str(info)[:300] if info != '' else ''))
C = '/api/agent/cerebro'
http('/api/auth/setup', {'token': 'token-de-prueba-123456', 'email': 'hb@prueba.test', 'name': 'HB Prueba', 'password': 'Clave-de-prueba-2026'})
s, d = http('/api/auth/login', {'email': 'hb@prueba.test', 'password': 'Clave-de-prueba-2026'}); check('entra la persona', s == 200, s)
s, tok = http('/api/auth/csrf'); X = {'x-csrf-token': tok.get('token', '')}
P = lambda body: http(C, body, headers=X)
s, st = http(C); GRANDE = st['settings']['models']['grande']
P({'action': 'ajustes', 'mode': 'proponer'})
pend = lambda: [r['id'] for r in http(C)[1].get('pending', [])]

IT = ('itinerario-prueba. Registra el viaje de HB (Humberto Bouche). 17 nov, Panamá 16:00–Miami 19:06, directo Copa; 22 nov, Miami 20:14–Toronto 23:37, directo American; '
      '26 nov, Toronto 16:00–Panamá 02:10 del 27 nov, con escala en San Salvador. No se ha verificado la emisión de boletos y las zonas horarias no están explícitas.')
s, r1 = P({'action': 'pedir', 'text': IT})
check('1. el itinerario queda como propuesta (nada aplicado)', r1.get('status') == 'pendiente' and not r1.get('changeId'), (s, r1.get('status'), r1.get('message')))
check('1b. usó el modelo grande por tener muchas horas', r1.get('model') == GRANDE, r1.get('model'))
ag = [o for o in r1.get('ops', []) if o['name'] == 'agendar']
check('2. un tramo por vuelo, con llegada y detalle completo', len(ag) == 3 and all(o['args'].get('hora_fin') and 'sin verificar' in o['args'].get('detalle', '') for o in ag), [o['args'] for o in ag][:1])
check('2b. el tramo del regreso llega el día siguiente', ag[2]['args'].get('fecha_fin') == '2026-11-27' and ag[2]['args'].get('hora_fin') == '02:10' and 'San Salvador' in ag[2]['args'].get('detalle', ''), ag[2]['args'])
check('2c. aerolíneas en el detalle', 'Copa' in ag[0]['args']['detalle'] and 'American' in ag[1]['args']['detalle'])
allcon = [c for o in ag for c in o['args'].get('con', [])]
check('3. no inventa: sin mercados ni empresas que nadie nombró', 'market-us-miami' not in allcon and 'dist-morgan-williams' not in allcon and allcon.count('person-humberto-bouche') == 3, allcon)
check('3b. y lo dice', any('Quité' in x for x in r1['obs']['supuso']), r1['obs']['supuso'])
check('4. el modelo no dice «ya agendé»', not any('He agendado' in x for x in r1['obs']['supuso']) and any('zonas horarias' in x for x in r1['obs']['supuso']), r1['obs']['supuso'])
check('5. informe claro: nada hecho, tres tramos esperando', 'NO se aplicó nada' in r1.get('message', '') and len(r1['report']['esperando']) == 3 and r1['report']['hecho'] == [], r1.get('report'))
check('5b. el plan muestra la llegada y el detalle', all('hasta' in p and 'detalle' in p for p in r1['plan']), r1['plan'][2][:200])
check('5c. el título del viaje no dice «con» la misma persona', not any('con Humberto' in p for p in r1['plan']), r1['plan'][0][:120])

# Corregir: reemplaza, no duplica
s, r2 = P({'action': 'pedir', 'text': 'Corrige la propuesta pendiente del viaje (itinerario-prueba): deja las llegadas y las dudas.'})
check('6. la corrección reemplaza a la anterior', r2.get('status') == 'pendiente' and r2.get('replaces') == r1['id'], (r2.get('status'), r2.get('replaces')))
st = http(C)[1]; sts = {r['id']: r['status'] for r in st.get('recent', []) + st.get('pending', [])}
check('6b. la anterior queda «reemplazada» y solo hay una pendiente', sts.get(r1['id']) == 'reemplazado' and pend() == [r2['id']], (sts.get(r1['id']), pend()))
check('6c. dice que reemplaza', r1['id'] in r2.get('message', ''), r2.get('message'))
check('6d. la corrección conserva todo (3 tramos con detalle)', len([o for o in r2['ops'] if o['name'] == 'agendar' and o['args'].get('detalle')]) == 3)
# Un pedido normal NO se confunde con corrección
s, r3 = P({'action': 'pedir', 'text': 'tarea-parecida'})
check('7. un pedido normal no reemplaza nada', r3.get('replaces') is None and r2['id'] in pend(), (r3.get('replaces'), pend()))
# Con dos pendientes y sin decir cuál: pregunta
s, r4 = P({'action': 'pedir', 'text': 'Corrige la propuesta pendiente: cambia la tarea'})
check('8. con varias pendientes pregunta cuál', r4.get('status') == 'pregunta' and r2['id'] in r4.get('message', ''), r4.get('message'))
s, r5 = P({'action': 'responder', 'id': r4['id'], 'text': f"La {r3['id']}"})
check('8b. al contestar, sigue con esa propuesta', r5.get('replaces') == r3['id'], (r5.get('status'), r5.get('replaces'), r5.get('message')))
s, q3 = P({'action': 'pedir', 'text': 'Llegaron los boletos del vuelo a Miami del 17; conserva los horarios y la escala.'})
check('12. «conserva los horarios» sin horarios guardados: los pide', q3.get('status') == 'pregunta' and 'horarios' in q3.get('message', ''), q3.get('message'))
# Aprobar la corregida: se aplica una sola vez
s, ap = P({'action': 'aprobar', 'id': r2['id']})
s, g = http('/api/agent/agenda?from=2026-11-17&to=2026-11-27'); ev = [o for o in g.get('occurrences', []) if o['title'].startswith('Vuelo')]
check('9. aprobada: 3 vuelos en la agenda, sin duplicados', ap.get('ok') and len({o['eventId'] for o in ev}) == 3, [o['title'] for o in ev])
# Preguntar en vez de rellenar
s, q1 = P({'action': 'pedir', 'text': 'Zulema confirmó el pedido de MEDIMEX para enero'})
check('10. persona que no existe: pregunta quién es, no adivina', q1.get('status') == 'pregunta' and 'Zulema' in q1.get('message', '') and not q1.get('ops'), (q1.get('status'), q1.get('message')))
s, q1b = P({'action': 'responder', 'id': q1['id'], 'text': 'Es Zulema Pérez, compras de MEDIMEX. Solo anótalo en MEDIMEX.'})
check('10b. con la respuesta, sigue y arma el plan', q1b.get('status') in ('pendiente', 'aplicado') and len(q1b.get('plan', [])) >= 1, (q1b.get('status'), q1b.get('message')))
s, q2 = P({'action': 'pedir', 'text': 'Richard envió la propuesta de MEDIMEX'})
check('11. nombre que puede ser varias personas: pregunta cuál', q2.get('status') == 'pregunta' and 'Richard Bailey' in q2.get('message', '') and 'Richard Williams' in q2.get('message', ''), q2.get('message'))
# Varios temas en un pedido
fill = ' Esto viene de los correos de hoy y hay que dejarlo anotado con cuidado, evitando duplicados y sin enviar mensajes a nadie.'
s, m = P({'action': 'pedir', 'text': 'indicador de ventas de la semana.' + fill + fill + ' || verificad: marca lo de medimex.' + fill})
parts = m.get('parts', [])
check('13. pedido de varios temas: se parte y cada tema es un pedido aparte', m.get('multi') and len(parts) == 2 and parts[0]['id'] != parts[1]['id'] and parts[0].get('group') == parts[1].get('group'), (m.get('status'), m.get('message', '')[:200]))
check('13b. cada tema con su plan propio y el modelo grande', [p['ops'][0]['name'] for p in parts if p.get('ops')] == ['registrar_indicador', 'marcar_verificado'] and all(p.get('model') == GRANDE for p in parts), [(p.get('status'), p.get('model')) for p in parts])
check('13c. el mensaje dice el estado de cada tema', 'Tema 1' in m.get('message', '') and 'Tema 2' in m.get('message', ''), m.get('message', '')[:260])
res_n = len(res); print(f"\n{sum(res)}/{res_n} pruebas"); raise SystemExit(0 if all(res) else 1)
