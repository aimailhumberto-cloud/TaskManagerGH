'use client';
import { useEffect, useRef, useState } from 'react';
import type { WhatsAppStatus } from '@/lib/whatsappStatus';
const labels = { connected: 'Conectada · verificada', disconnected: 'Desconectada', unavailable: 'Dato no disponible', identity_mismatch: 'Identidad por comprobar' };
const date = (value: string | null) => value ? new Date(value).toLocaleString('es', { timeZone: 'America/Panama' }) + ' · Panamá' : 'Dato no disponible';
export default function WhatsAppPanel() {
  const [data, setData] = useState<WhatsAppStatus | null>(null), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const active = useRef(true), controller = useRef<AbortController | null>(null);
  async function refresh() {
    controller.current?.abort(); const current = new AbortController(); controller.current = current; setBusy(true); setError('');
    try { const response = await fetch('/api/integrations/whatsapp/status', { cache: 'no-store', signal: current.signal }); if (!response.ok) throw new Error(); const result = await response.json(); if (active.current && !current.signal.aborted) setData(result); }
    catch { if (active.current && !current.signal.aborted) { setError('No se pudo comprobar el estado. Vuelve a consultar.'); setData(null); } }
    finally { if (active.current && !current.signal.aborted) setBusy(false); }
  }
  useEffect(() => { active.current = true; refresh(); return () => { active.current = false; controller.current?.abort(); }; }, []);
  return <section aria-label="Estado de WhatsApp" className="tm-pane tm-pane-dark"><div className="tm-heading"><h2>WhatsApp</h2><button className="tm-soft-button" disabled={busy} onClick={refresh}>{busy ? 'Consultando…' : 'Actualizar estado'}</button></div><p>Personal y BEE SMART · consulta de estado sin leer mensajes.</p>{error && <p role="alert">{error}</p>}<p role="status" className="tm-source-stamp">{busy ? 'Comprobando conexión…' : data ? `Consultado ${date(data.checkedAt)}` : 'Sin lectura disponible'}</p><div className="grid gap-4 md:grid-cols-2">{(data?.accounts || [{ id: 'personal', name: 'Personal', state: 'unavailable' as const, checkedAt: '', lastActivityAt: null }, { id: 'bee-smart', name: 'BEE SMART', state: 'unavailable' as const, checkedAt: '', lastActivityAt: null }]).map(account => <article className="tm-pane tm-pane-stone" key={account.id} aria-label={`WhatsApp ${account.name}`}><h3>{account.name}</h3><p>{busy ? 'Conexión por comprobar' : labels[account.state]}</p><p className="tm-small">Última actividad: {date(account.lastActivityAt)}</p></article>)}</div><article className="tm-pane tm-pane-stone mt-4"><h3>Túnel</h3><p>Estado actual: dato no disponible</p>{data?.tunnel.state === 'historical' && <p className="tm-small">Registro local del {date(data.tunnel.evidenceAt)}: {data.tunnel.lastReportedHealthy === true ? 'saludable en esa comprobación' : 'sin salud confirmada'}. Este registro no verifica la conexión actual.</p>}</article><article className="mt-4"><h3>Permisos</h3><p>Vencimiento: {date(data?.permissions.expiresAt || null)}</p><p>Última renovación: {date(data?.permissions.renewedAt || null)}</p><p className="tm-small">El gateway no expone estos datos en su contrato de estado. Este panel no renueva permisos ni inicia conexiones.</p></article></section>;
}
