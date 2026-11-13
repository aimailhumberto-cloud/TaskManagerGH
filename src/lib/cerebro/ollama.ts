/**
 * Conexión con Ollama en la nube (modelo de lenguaje del Cerebro). La llave vive en Render (OLLAMA_API_KEY).
 * OLLAMA_HOST permite apuntar a otro servidor compatible (pruebas). La nube de Ollama no garantiza formato de
 * salida, por eso el plan viaja como llamadas a herramientas y la app lo revisa siempre.
 */
export interface ChatMessage { role: 'system' | 'user' | 'assistant' | 'tool'; content: string; tool_calls?: ToolCall[]; tool_name?: string }
export interface ToolCall { function: { name: string; arguments: Record<string, unknown> | string } }
export interface ToolDef { type: 'function'; function: { name: string; description: string; parameters: Record<string, unknown> } }
export interface ChatResult { content: string; toolCalls: { name: string; args: Record<string, unknown> }[]; model: string; inputTokens: number; outputTokens: number; ms: number }
export class LlmError extends Error { constructor(message: string, public status = 502) { super(message); } }

const host = () => (process.env.OLLAMA_HOST || 'https://ollama.com').replace(/\/$/, '');
const key = () => process.env.OLLAMA_API_KEY?.trim() || '';
export const llmConfigured = () => !!key();
const headers = () => ({ 'Content-Type': 'application/json', Authorization: `Bearer ${key()}` });

async function call(path: string, init: RequestInit, timeoutMs: number): Promise<any> {
  if (!key()) throw new LlmError('Falta OLLAMA_API_KEY en Render.', 503);
  const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const res = await fetch(host() + path, { ...init, headers: headers(), signal: ctl.signal });
    if (res.status === 401 || res.status === 403) throw new LlmError('Ollama rechazó la llave (revisa OLLAMA_API_KEY en Render).', 502);
    if (res.status === 402) throw new LlmError('La cuenta de Ollama no tiene saldo o el modelo no está en tu plan.', 502);
    if (res.status === 404) throw new LlmError('Ollama no conoce ese modelo. Elige otro en Ajustes.', 502);
    if (res.status === 429) throw new LlmError('Ollama está ocupado (demasiados pedidos a la vez). Reintenta en un momento.', 503);
    if (!res.ok) throw new LlmError(`Ollama respondió ${res.status}.`, 502);
    return await res.json();
  } catch (e: any) {
    if (e instanceof LlmError) throw e;
    throw new LlmError(e?.name === 'AbortError' ? 'Ollama tardó demasiado en responder.' : 'No se pudo conectar con Ollama.', 503);
  } finally { clearTimeout(timer); }
}

export async function chat(model: string, messages: ChatMessage[], tools?: ToolDef[], timeoutMs = 90_000): Promise<ChatResult> {
  const t0 = Date.now();
  const d = await call('/api/chat', { method: 'POST', body: JSON.stringify({ model, messages, stream: false, ...(tools?.length ? { tools } : {}), options: { temperature: 0 } }) }, timeoutMs);
  const raw = Array.isArray(d?.message?.tool_calls) ? d.message.tool_calls : [];
  const toolCalls = raw.map((c: any) => {
    let args = c?.function?.arguments;
    if (typeof args === 'string') { try { args = JSON.parse(args); } catch { args = {}; } }
    return { name: String(c?.function?.name || ''), args: args && typeof args === 'object' ? args : {} };
  }).filter((c: { name: string }) => c.name);
  return { content: String(d?.message?.content || ''), toolCalls, model: String(d?.model || model), inputTokens: Number(d?.prompt_eval_count) || 0, outputTokens: Number(d?.eval_count) || 0, ms: Date.now() - t0 };
}
export async function listModels(): Promise<string[]> {
  const d = await call('/api/tags', { method: 'GET' }, 10_000);
  return (Array.isArray(d?.models) ? d.models : []).map((m: any) => String(m.name || m.model)).filter(Boolean).sort();
}
export async function balance(): Promise<{ includedUsd: number | null; purchasedUsd: number | null } | null> {
  try { const d = await call('/api/balance', { method: 'GET' }, 8_000); return { includedUsd: d?.included?.balance_usd ?? null, purchasedUsd: d?.purchased?.balance_usd ?? null }; } catch { return null; }
}
