# Fase 1 del motor: entrada tolerante, repetidos y caja negra. Servidor como e2e-agentes.py (SESSION_SECRET, AGENT_API_KEY=k-prueba-123), vault limpio.
import json, urllib.request, urllib.error, http.cookiejar
B = 'http://localhost:3979'; C = '/api/agent/cerebro'
jar = http.cookiejar.CookieJar(); opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar))
def call(path, raw=None, ctype='application/json', agent=True, headers=None, method=None):
    h = {'Origin': B, **(headers or {})}
    if raw is not None: h['Content-Type'] = ctype
    if agent: h['x-agent-key'] = 'k-prueba-123'
    elif len(jar): h['Cookie'] = '; '.join(f'{c.name}={c.value}' for c in jar)
    data = raw.encode() if isinstance(raw, str) else (json.dumps(raw).encode() if raw is not None else None)
    req = urllib.request.Request(B + path, data=data, headers=h, method=method or ('POST' if data is not None else 'GET'))
    try:
        with (urllib.request.urlopen(req) if agent else opener.open(req)) as r: return r.status, json.loads(r.read().decode() or '{}')
    except urllib.error.HTTPError as e:
        try: return e.code, json.loads(e.read().decode() or '{}')
        except Exception: return e.code, {}
res = []
def check(n, c, i=''): res.append(bool(c)); print(('OK   ' if c else 'FALLA'), n, ('· ' + str(i)[:240] if i != '' else ''))
call('/api/auth/setup', {'token': 'token-de-prueba-123456', 'email': 'hb@prueba.test', 'name': 'HB Prueba', 'password': 'Clave-de-prueba-2026'}, agent=False)
s, _ = call('/api/auth/login', {'email': 'hb@prueba.test', 'password': 'Clave-de-prueba-2026'}, agent=False); check('entra la persona', s == 200, s)
s, tok = call('/api/auth/csrf', agent=False); X = {'x-csrf-token': tok.get('token', '')}
T1 = 'Registra una llamada con Tomás Casas sobre el second brain, ayer'
s, a = call(C, {'action': 'ask', 'message': T1})
check('1. acción «ask» y campo «message» se entienden', s in (200, 202) and a.get('id') and any('ask' in x for x in a.get('entrada', {}).get('arreglos', [])), (s, a.get('entrada')))
s, b = call(C, 'Registra que Tomás Casas confirmó la reunión del viernes', ctype='text/plain')
check('2. texto plano se toma como pedido', s in (200, 202) and b.get('id') and any('no era JSON' in x for x in b['entrada']['arreglos']), (s, b.get('entrada')))
s, c = call(C, 'action=pedir&text=' + urllib.request.quote('Crea una tarea para llamar a Luisa Santos mañana'), ctype='application/x-www-form-urlencoded')
check('3. formulario se convierte', s in (200, 202) and c.get('id'), (s, c.get('entrada')))
s, d = call(C, '{"action":"pedir","text":"Anota que Richard Bailey llamó hoy",}')
check('4. JSON con coma final se arregla', s in (200, 202) and d.get('id'), (s, d.get('entrada')))
s, e = call(C, {'action': 'ask', 'message': T1})
check('5. lo mismo otra vez: devuelve el caso abierto, no abre otro', e.get('repeated') is True and e.get('id') == a.get('id'), (e.get('repeated'), e.get('id'), a.get('id')))
s, f = call(C, {'action': 'consultar', 'q': 'Registra que el distribuidor MEDIMEX pidió nueva cotización para el lunes', 'md': '# Caso\nMEDIMEX pidió cotización.'})
check('6. «consultar» con MD se trata como pedir y lo dice', s in (200, 202) and any('consultar' in x for x in f.get('entrada', {}).get('arreglos', [])), (s, f.get('entrada')))
s, g = call(C, {'action': 'consultar', 'q': '¿Qué reuniones hay hoy?'})
check('7. una pregunta real sigue siendo consulta (no escribe)', s == 200 and 'entrada' not in g, (s, list(g)[:6]))
s, h = call(C, {'foo': 'bar'})
check('8. sin nada útil: no pasa, y la caja negra lo guarda', s in (400, 403), s)
s, q = call(C + '?question=que%20hay%20hoy')
check('9. GET con «question» consulta', s == 200 and q.get('answer'), (s, list(q)[:5]))
s, caja = call(C + '?caja=1&n=50', agent=False)
ll = caja.get('llamadas', [])
check('10. la persona ve la caja negra con lo que mandó cada agente', s == 200 and len(ll) >= 6 and any(x.get('arreglos') for x in ll) and any(x.get('blocked') or x.get('status') in (400, 403) for x in ll), (s, len(ll)))
check('11. la caja negra no guarda llaves', 'k-prueba-123' not in json.dumps(caja), '')
s, caja2 = call(C + '?caja=1', headers={'x-agent-key': 'k-prueba-123'})
check('12. el agente no ve la caja negra', 'llamadas' not in caja2, list(caja2)[:4])
print(f'\n{sum(res)}/{len(res)} pruebas')
