# Los 9 casos de la auditoría de la vuelta 21 contra un servidor local con copia de la bóveda.
# Uso: levantar `next start -p 3979` con AGENT_API_KEY=k-prueba-123 y SMJ_VAULT_PATH=<copia>, luego: python3 scripts/e2e-fase1.py
import json, urllib.request, urllib.parse, re, sys
B = 'http://localhost:3979'
def call(path, body=None, headers=None):
    h = {'x-agent-key': 'k-prueba-123', 'Content-Type': 'application/json', **(headers or {})}
    req = urllib.request.Request(B + path, data=(json.dumps(body).encode() if body is not None else None), headers=h, method='POST' if body is not None else 'GET')
    try:
        with urllib.request.urlopen(req) as r: return r.status, json.loads(r.read().decode())
    except urllib.error.HTTPError as e:
        t = e.read().decode()
        try: return e.code, json.loads(t)
        except Exception: return e.code, t[:300]
node = lambda i: call('/api/agent/brain?node=' + urllib.parse.quote(i))[1].get('node')
res = []
def check(name, cond, info=''):
    res.append(bool(cond)); print(('OK   ' if cond else 'FALLA'), name, ('· ' + str(info) if info else ''))

call('/api/agent/agenda', {'action': 'set', 'kind': 'reunion', 'title': 'Panama-Handover MEDIMEX', 'date': '2026-11-12', 'time': '15:00'})

print('### A · una llamada deja ficha, agenda y tarea al día')
s, r = call('/api/agent/brain', {'action': 'record', 'nodeId': 'dist-medimex', 'type': 'correo', 'summary': 'Gabriela Trigueros movió el Panama-Handover MEDIMEX del jueves 12 al lunes 16 de noviembre, 15:00.', 'source': 'correo de Gabriela Trigueros, 12 nov 09:54', 'lastEmail': {'subject': 'Panama-Handover MEDIMEX (actualizado)', 'date': '2026-11-12', 'sender': 'Gabriela Trigueros'}, 'followup': {'date': '2026-11-16', 'action': 'Panama-Handover MEDIMEX 15:00'}, 'state': 'Handover con MEDIMEX vigente: lunes 16 nov, 15:00 (hora Panamá).', 'event': {'title': 'Panama-Handover MEDIMEX', 'date': '2026-11-16', 'time': '15:00', 'endTime': '16:00'}, 'task': {'title': 'Responder la invitación del Panama-Handover', 'dueDate': '2026-11-13', 'priority': 'High'}})
print('   ', s, json.dumps(r.get('done'), ensure_ascii=False))
n = node('dist-medimex'); fm = n['frontmatter']; body = n['body']
check('ficha: próximo seguimiento 16', fm.get('next_followup_date') == '2026-11-16')
check('ficha: último correo actualizado', fm.get('last_email_date') == '2026-11-12')
check('ficha: fecha de cambio puesta', bool(fm.get('updated_at')), fm.get('updated_at'))
check('ficha: estado actual antes de las secciones y bitácora', 0 < body.find('## Estado actual') < body.find('## Datos') and '## Bitácora' in body)
s, a = call('/api/agent/agenda?from=2026-11-10&to=2026-11-20'); reu = [(o['date'], o.get('time')) for o in a['occurrences'] if o['layer'] == 'reuniones']
check('agenda: movida al 16 y sin la del 12', ('2026-11-16', '15:00') in reu and ('2026-11-12', '15:00') not in reu, reu)
s, t = call('/api/agent/tasks'); check('tarea creada con id devuelto', r.get('taskId') and any(x['id'] == r['taskId'] for x in t['tasks']), r.get('taskId'))
check('recibo con cómo deshacer', bool(r.get('receipt', {}).get('changeId')))
rec_change = r['receipt']['changeId']
s, r = call('/api/agent/brain', {'action': 'record', 'nodeId': 'dist-medimex', 'summary': 'Prueba que debe fallar', 'event': {'title': 'Sin fecha'}})
check('todo o nada: si falla la agenda no queda nada en la ficha', s >= 400 and 'Prueba que debe fallar' not in node('dist-medimex')['body'], s)

print('### A2 · consolidar pasa la nota a la bitácora')
call('/api/agent/brain', {'action': 'remember_working', 'title': 'MEDIMEX pidió lista de precios 2027', 'content': 'Gabriela pidió la lista de precios 2027 para Chubby antes del handover.', 'links': ['[[Distributor - MEDIMEX]]']})
s, c = call('/api/agent/brain', {'action': 'consolidate_session', 'sessionSummary': 'prueba'})
check('consolidación copió a la bitácora', c['result'].get('loggedCount', 0) >= 1 and 'lista de precios 2027' in node('dist-medimex')['body'])

print('### B · una copia vieja ya no pisa')
p = '02-External-Clients/Distributor - MEDIMEX.md'
s, f = call('/api/agent/vault-sync?path=' + urllib.parse.quote(p)); old, oldhash = f['content'], f['hash']
call('/api/agent/brain', {'action': 'update_dossier', 'nodeId': 'dist-medimex', 'nextFollowupDate': '2026-11-17'})
s, _ = call('/api/agent/vault-sync', {'action': 'write_file', 'path': p, 'content': old + '\n\nViejo.', 'ifMatch': oldhash})
check('huella vieja: 409 y no pisa', s == 409 and node('dist-medimex')['frontmatter']['next_followup_date'] == '2026-11-17', s)
s, _ = call('/api/agent/vault-sync', {'action': 'write_file', 'path': p, 'content': old}); check('sin huella: 428', s == 428, s)
s, r = call('/api/agent/vault-sync', {'action': 'batch_sync', 'files': [{'path': p, 'content': old}]}); check('batch_sync también rechaza', r.get('syncedCount') == 0 and len(r.get('rejected', [])) == 1)
s, f = call('/api/agent/vault-sync?path=' + urllib.parse.quote(p))
s, _ = call('/api/agent/vault-sync', {'action': 'write_file', 'path': p, 'content': f['content'] + '\n\n## Evidencia\n\nNota larga.\n', 'ifMatch': f['hash']})
check('huella actual: guarda', s == 200 and 'Nota larga' in node('dist-medimex')['body'], s)

print('### C · upsert_node combina')
p2 = '01-Internal-Clients/Person - Stephanie Lahourie.md'
keys = lambda txt: set(re.findall(r'^([a-z_]+):', txt.split('---')[1], re.M))
s, f = call('/api/agent/vault-sync?path=' + urllib.parse.quote(p2)); before = keys(f['content']); idm = re.search(r'^id:\s*(.+)$', f['content'], re.M).group(1).strip()
call('/api/agent/brain', {'action': 'upsert_node', 'relativePath': p2, 'frontmatter': {'id': idm, 'job_title': 'Nuevo cargo'}, 'body': ''})
s, f = call('/api/agent/vault-sync?path=' + urllib.parse.quote(p2)); after = keys(f['content'])
check('conserva y agrega', before <= after and 'job_title' in after, f'{len(before)} → {len(after)}')
s, _ = call('/api/agent/brain', {'action': 'upsert_node', 'relativePath': p2, 'frontmatter': {'id': idm, 'title': 'x', 'type': 'person'}, 'body': 'x', 'replace': True}); check('reemplazo exige huella', s == 428, s)
s, _ = call('/api/agent/brain', {'action': 'upsert_node', 'relativePath': '01-Internal-Clients/Otra.md', 'frontmatter': {'id': 'dist-medimex', 'title': 'dup', 'type': 'distributor'}, 'body': 'x'}); check('id repetido: 409', s == 409, s)

print('### E · crear tarea devuelve su id')
s, r = call('/api/agent/tasks', {'action': 'create', 'title': 'Enviar lista de precios 2027', 'dueDate': '2026-11-15', 'targetNodeId': 'dist-medimex'}); check('taskId', bool(r.get('taskId')), r.get('taskId'))

print('### F · encabezado roto no entra')
s, _ = call('/api/agent/vault-sync', {'action': 'write_file', 'path': '02-External-Clients/Customer - Rota.md', 'content': '---\nid: x\ntitle: "Rota\ntype: customer\n---\nCuerpo'}); check('400', s == 400, s)

print('### G · reintentos sin duplicados')
ids = [call('/api/agent/brain', {'action': 'remember_working', 'title': 'Dato repetido', 'content': 'x'})[1]['result']['id'] for _ in range(2)]
check('misma captura: una nota', ids[0] == ids[1])
k = {'Idempotency-Key': 'prueba-123'}
call('/api/agent/tasks', {'action': 'create', 'title': 'Tarea con clave', 'targetNodeId': 'dist-medimex'}, k); s2, r2 = call('/api/agent/tasks', {'action': 'create', 'title': 'Tarea con clave', 'targetNodeId': 'dist-medimex'}, k)
s, t = call('/api/agent/tasks'); check('misma clave: una tarea', len([x for x in t['tasks'] if x['title'] == 'Tarea con clave']) == 1 and r2.get('repeated'))

print('### H · agenda sin duplicados')
for _ in range(2): call('/api/agent/agenda', {'action': 'set', 'kind': 'reunion', 'title': 'Llamada Morgan Williams', 'date': '2026-11-18', 'time': '10:00'})
s, a = call('/api/agent/agenda?from=2026-11-18&to=2026-11-18'); check('una reunión', len([o for o in a['occurrences'] if o['title'] == 'Llamada Morgan Williams']) == 1)

print('### I · qué cambió, deshacer y brief')
s, ch = call('/api/agent/changes?since=2026-11-01'); check('diario con entradas', ch['count'] >= 8, ch['count'])
s, u = call('/api/agent/changes', {'action': 'undo', 'changeId': rec_change}); check('deshacer algo tocado después: 409', s == 409, u.get('changedSince'))
s, u = call('/api/agent/changes', {'action': 'undo', 'changeId': ch['entries'][0]['id']}); check('deshacer el último', s == 200, u.get('message', '')[:100])
s, b = call('/api/agent/brief?since=2026-11-01'); check('brief con hora y novedades', b.get('ok') and b['dataAsOf']['panama'] and len(b['changes']['items']) >= 8, f"agenda {len(b['agenda'])}, vencidas {len(b['tasks']['overdue'])}")
s, _ = call('/api/agent/brief', None, {'x-agent-key': 'tmk_falsa_123'}); check('llave falsa: 401', s == 401, s)

print(f'\n{sum(res)}/{len(res)} comprobaciones OK'); sys.exit(0 if all(res) else 1)
