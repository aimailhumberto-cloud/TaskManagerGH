# Ollama simulado para probar el Cerebro sin llave real. Responde con planes fijos según palabras del pedido.
# Uso: python3 scripts/fake-ollama.py 3981   (y el servidor con OLLAMA_HOST=http://localhost:3981 OLLAMA_API_KEY=prueba)
import json, sys, re
from http.server import BaseHTTPRequestHandler, HTTPServer
MANY = ['brand-oasis', 'brand-fruta', 'brand-chubby', 'brand-busta', 'brand-altitude', 'person-richard-bailey', 'person-angelo-martinez', 'person-amir-hosein', 'person-alanna-ramjattan', 'person-luisa-santos', 'person-sonia-harris', 'person-eesa-mohammed']
tc = lambda name, **args: {'function': {'name': name, 'arguments': args}}
def plan(text, msgs):
    fixed = any('encontró errores' in m.get('content', '') for m in msgs)
    searched = any(m.get('role') == 'tool' for m in msgs)
    t = text.lower()
    if 'siempre-mal' in t: return [tc('registrar_novedad', ficha='dist-no-existe', resumen='x')]
    if 'ficha-inventada' in t: return [tc('registrar_novedad', ficha='dist-medimex' if fixed else 'dist-inventado', resumen='Corregido tras revisión')]
    if 'buscar-primero' in t: return [tc('registrar_novedad', ficha='dist-medimex', resumen='Encontrado con buscar')] if searched else [tc('buscar', q='medimex')]
    if 'ambiguo' in t: return [tc('preguntar', pregunta='¿De qué distribuidor hablas?')]
    if 'borra' in t: return [tc('borrar_ficha', ficha='person-luisa-santos', motivo='Duplicada')]
    if 'verificad' in t: return [tc('marcar_verificado', ficha='dist-medimex', fuente='El texto del correo lo dice')]
    if 'crea distribuidor' in t: return [tc('crear_ficha', tipo='distributor', nombre='Prueba E2E', campos={'based_in_city': 'Toronto'}, conectar_con=[{'hacia': 'market-canada', 'relacion': 'operates_in_market'}]), tc('registrar_novedad', ficha='dist-prueba-e2e', resumen='Primer contacto por correo'), tc('conectar', desde='dist-prueba-e2e', hacia='brand-busta', relacion='carries_brand')]
    if 'grande' in t: return [tc('registrar_novedad', ficha=i, resumen='Corrección masiva de contacto') for i in MANY]
    if 'indicador' in t: return [tc('registrar_indicador', nombre='Ventas Canadá E2E', valor=1250, unidad='cajas', nota='Dato del pedido')]
    if 'falla-al-aplicar' in t: return [tc('registrar_novedad', ficha='dist-medimex', resumen='ESTO NO DEBE QUEDAR'), tc('completar_tarea', tarea='tarea-que-no-existe')]
    if 'relacion-mala' in t: return [tc('conectar', desde='dist-medimex', hacia='brand-busta', relacion='amigos_de')] if not fixed else [tc('conectar', desde='dist-medimex', hacia='brand-busta', relacion='carries_brand')]
    if 'medimex' in t: return [tc('registrar_novedad', ficha='dist-medimex', resumen='La reunión pasó al lunes 16 a las 15:00', tipo='correo', estado_actual='Reunión confirmada para el lunes 16 a las 15:00', proximo_paso_fecha='2026-11-16', proximo_paso='Reunión con MEDIMEX'), tc('agendar', titulo='Reunión MEDIMEX E2E', fecha='2026-11-16', hora='15:00', ficha='dist-medimex'), tc('crear_tarea', ficha='dist-medimex', titulo='Enviar propuesta a MEDIMEX', vence='2026-11-20')]
    return []
class H(BaseHTTPRequestHandler):
    def log_message(self, *a): pass
    def send(self, code, obj):
        b = json.dumps(obj).encode(); self.send_response(code); self.send_header('Content-Type', 'application/json'); self.send_header('Content-Length', str(len(b))); self.end_headers(); self.wfile.write(b)
    def auth(self):
        if self.headers.get('Authorization') != 'Bearer prueba': self.send(401, {'error': 'unauthorized'}); return False
        return True
    def do_GET(self):
        if not self.auth(): return
        if self.path == '/api/tags': return self.send(200, {'models': [{'name': 'gemma4'}, {'name': 'kimi-k2.6'}, {'name': 'glm-5.3-flash'}]})
        if self.path == '/api/balance': return self.send(200, {'included': {'balance_usd': 19.5}, 'purchased': {'balance_usd': 0}})
        self.send(404, {})
    def do_POST(self):
        if not self.auth(): return
        body = json.loads(self.rfile.read(int(self.headers.get('Content-Length', 0))) or b'{}')
        if body.get('model') == 'modelo-roto': return self.send(404, {'error': 'model not found'})
        msgs = body.get('messages', [])
        first = next((m['content'] for m in msgs if m['role'] == 'user'), '')
        if not body.get('tools'):
            return self.send(200, {'model': body['model'], 'message': {'role': 'assistant', 'content': 'listo' if 'listo' in first else 'Respuesta redactada por el modelo con los datos del cerebro.'}, 'prompt_eval_count': 900, 'eval_count': 40})
        m = re.search(r'"""\n(.*)\n"""', first, re.S)
        calls = plan(m.group(1) if m else first, msgs)
        self.send(200, {'model': body['model'], 'message': {'role': 'assistant', 'content': '' if calls else 'No sé qué hacer con eso.', 'tool_calls': calls}, 'prompt_eval_count': 2100, 'eval_count': 120})
HTTPServer(('127.0.0.1', int(sys.argv[1]) if len(sys.argv) > 1 else 3981), H).serve_forever()
