/**
 * Regla de entrada de los agentes: pedir y consultar.
 * Toda llave de agente (la general de DOTS o una por agente) puede LEER lo que quiera, pero escribir solo pidiéndoselo al Cerebro.
 * El Cerebro es quien escribe en las fichas; así cada cambio pasa por su revisión, su autonomía, el diario y el deshacer.
 * Sin imports de datos: lo usan withBrain y las pruebas.
 *
 * Salida de emergencia: AGENT_WRITE_MODE=legacy en Render devuelve el comportamiento anterior (sin redeploy de código).
 */
export const AGENT_ALLOWED: Record<string, string[]> = {
  '/api/agent/cerebro': ['pedir', 'leer', 'consultar', 'responder', 'aprobar', 'rechazar'],
};
export const legacyWriteMode = (env: string | undefined = process.env.AGENT_WRITE_MODE) => env === 'legacy';
export const agentMayWrite = (path: string, action?: string): boolean => !!action && (AGENT_ALLOWED[path] || []).includes(action);
export const ASK_HINT = "POST /api/agent/cerebro {action:'pedir', text:'lo que quieres que pase, en palabras'} (o 'consultar' con q, 'leer' con un correo o nota, 'responder' a una pregunta suya).";
