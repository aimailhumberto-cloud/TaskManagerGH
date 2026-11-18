'use client';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import PageHero from '@/components/PageHero';
import { useUiLang } from '@/lib/uiLang';
import {
  CHANNELS, COLD_OWNERS, CONDITIONS, COUNTRIES, HEIGHTS, PHOTO_TAGS, PLACES, POSITIONS, PRESENCE, SECOND_SPOTS,
  type Catalog, type CompetitorCheck, type ProductCheck, type Tri, type Visit, type VisitSummary,
} from '@/lib/storeCheck';

/* Store check: pestaña aparte del Task Manager. No toca el Cerebro. */

type Row = { id: string; status: string; checkIn: string; by: { id: string; name: string }; store: Visit['store']; score: number | null; photosPending: boolean; summary: VisitSummary };
type Me = { id: string; name: string; canWrite: boolean; manager: boolean };
type Step = 'tienda' | 'productos' | 'frio' | 'competencia' | 'fotos' | 'cierre';

const BLUE = '#0a3fbf', NAVY = '#0b1f4d', LINE = '#dbe4f3';
const card = 'rounded-2xl border border-[#dbe4f3] bg-white p-4 shadow-[0_12px_28px_-18px_rgba(11,31,77,0.22)]';
const btn = 'rounded-xl bg-[#0a3fbf] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#08318f] disabled:opacity-50';
const ghost = 'rounded-xl border border-[#dbe4f3] bg-[#f2f6fd] px-3 py-2 text-sm font-semibold text-[#0a3fbf] hover:bg-[#e8eef9] disabled:opacity-50';
const input = 'w-full rounded-xl border border-[#dbe4f3] bg-white px-3 py-2.5 text-[15px] text-slate-800 outline-none focus:border-[#0a3fbf]';
const lbl = 'mb-1 block text-xs font-semibold text-slate-600';
const DRAFT = 'storecheck-draft';

const emptyProduct = (p: { id: string; name: string; brand: string }): ProductCheck => ({ productId: p.id, name: p.name, brand: p.brand, presence: '', place: '', position: '', height: '', facings: null, shelfShare: null, flavorsFound: [], price: null, priceTag: null, promo: null, promoDetail: '', inCold: null, expiry: '', condition: '', backstock: null, notes: '' });
const emptyCompetitor = (): CompetitorCheck => ({ id: `c${Date.now().toString(36)}`, brand: '', product: '', category: '', price: null, promo: null, promoDetail: '', facings: null, position: '', inCold: null, newLaunch: null, notes: '' });
function newVisit(catalog: Catalog, me: Me | null): Visit {
  const now = new Date().toISOString();
  return {
    id: '', status: 'abierta', createdAt: now, updatedAt: now, checkIn: now, checkOut: '', by: { id: me?.id || '', name: me?.name || '' },
    store: { name: '', chain: '', channel: '', country: 'Panamá', city: '', address: '', contact: '', contactPhone: '' }, location: null,
    products: catalog.products.filter(p => p.active).map(emptyProduct), competitors: [],
    cold: { has: null, owner: '', doors: null, ourShare: null, foreignInOurs: null, working: null, clean: null, notes: '' },
    secondary: { has: null, where: [], notes: '' }, pop: { ours: null, competitors: null, notes: '' },
    score: null, notes: '', followUps: '', photosPending: false, photos: [],
  };
}
const readDraft = (): Visit | null => { try { const v = JSON.parse(localStorage.getItem(DRAFT) || 'null'); return v && v.store ? v : null; } catch { return null; } };
const writeDraft = (v: Visit | null) => { try { v ? localStorage.setItem(DRAFT, JSON.stringify(v)) : localStorage.removeItem(DRAFT); } catch {} };

/** Achica la foto en el teléfono antes de subirla (1600 px, JPG): sube más rápido con poca señal. */
async function shrink(file: File): Promise<Blob> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size < 400_000) return file;
  try {
    const bmp = await createImageBitmap(file);
    const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k);
    c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height);
    const out: Blob | null = await new Promise(r => c.toBlob(r, 'image/jpeg', 0.82));
    return out && out.size < file.size ? out : file;
  } catch { return file; }
}

export default function StoreCheckPage() {
  const { L, locale } = useUiLang();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [visit, setVisit] = useState<Visit | null>(null);
  const [editable, setEditable] = useState(true);
  const [step, setStep] = useState<Step>('tienda');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [draft, setDraft] = useState<Visit | null>(null);
  const [showCatalog, setShowCatalog] = useState(false);
  const [filter, setFilter] = useState({ q: '', country: '', mine: false });

  const load = useCallback(async () => {
    const r = await fetch('/api/store-checks', { cache: 'no-store' }); const d = await r.json().catch(() => ({}));
    if (!r.ok) { setError(d.error || L('Sin acceso.', 'No access.')); return; }
    setRows(d.visits); setMe(d.me); setCatalog(d.catalog); setError(null);
  }, [L]);
  useEffect(() => { load(); setDraft(readDraft()); }, [load]);

  // Abrir la visita de la dirección (?v=…) al recargar.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get('v');
    if (id && !visit) open(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const setUrl = (id: string) => { try { const u = new URL(window.location.href); id ? u.searchParams.set('v', id) : u.searchParams.delete('v'); window.history.replaceState(null, '', u.toString()); } catch {} };

  async function open(id: string) {
    const r = await fetch(`/api/store-checks?id=${encodeURIComponent(id)}`, { cache: 'no-store' }); const d = await r.json().catch(() => ({}));
    if (!r.ok) { setMsg({ ok: false, text: d.error || L('No se pudo abrir.', 'Could not open.') }); return; }
    const local = readDraft();
    // Si en el teléfono hay cambios sin subir de esta misma visita, se usan esos.
    const v: Visit = local && local.id === id && local.updatedAt > d.visit.updatedAt ? { ...local, photos: d.visit.photos } : d.visit;
    if (catalog || d.catalog) { const cat: Catalog = d.catalog || catalog; for (const p of cat.products.filter(p => p.active)) if (!v.products.some(x => x.productId === p.id)) v.products.push(emptyProduct(p)); }
    setVisit(v); setEditable(!!d.canEdit); setStep('tienda'); setMsg(null); setUrl(id);
  }
  function start() {
    if (!catalog) return;
    const v = newVisit(catalog, me); setVisit(v); setEditable(true); setStep('tienda'); setMsg(null); writeDraft(v); setDraft(v);
    locate(v);
  }
  function close() { setVisit(null); setUrl(''); setDraft(readDraft()); load(); }

  // Cada cambio queda guardado en el teléfono (por si se va la señal).
  const change = useCallback((fn: (v: Visit) => Visit) => {
    setVisit(prev => { if (!prev) return prev; const next = fn({ ...prev }); next.updatedAt = new Date().toISOString(); writeDraft(next); return next; });
  }, []);

  function locate(base?: Visit) {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      p => change(v => ({ ...v, location: { lat: p.coords.latitude, lng: p.coords.longitude, accuracy: Math.round(p.coords.accuracy) } })),
      () => { if (!base) setMsg({ ok: false, text: L('No se pudo leer la ubicación. Revisa el permiso del navegador.', 'Could not read location. Check browser permission.') }); },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 60000 },
    );
  }

  async function save(extra?: Partial<Visit>): Promise<Visit | null> {
    if (!visit) return null;
    const body = { ...visit, ...extra };
    if (!body.store.name.trim()) { setStep('tienda'); setMsg({ ok: false, text: L('Escribe el nombre de la tienda.', 'Write the store name.') }); return null; }
    setSaving(true); setMsg(null);
    try {
      const r = await fetch('/api/store-checks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'save', visit: body }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setMsg({ ok: false, text: d.error || L('No se pudo guardar.', 'Could not save.') }); return null; }
      const saved: Visit = d.visit;
      // Si se siguió escribiendo mientras se guardaba, se conserva lo nuevo (con el id y las fotos del servidor).
      setVisit(cur => {
        if (cur && cur.updatedAt !== body.updatedAt) { const keep = { ...cur, id: saved.id, photos: saved.photos, checkIn: saved.checkIn, by: saved.by }; writeDraft(keep); return keep; }
        writeDraft(null); return saved;
      });
      setDraft(null); setUrl(saved.id);
      setMsg({ ok: true, text: L('Guardado.', 'Saved.') });
      return saved;
    } catch {
      setMsg({ ok: false, text: L('Sin señal: quedó guardado en este teléfono. Toca «Guardar» cuando vuelva la señal.', 'No signal: kept on this phone. Tap “Save” when you are back online.') });
      return null;
    } finally { setSaving(false); }
  }

  if (error) return <Shell L={L}><div className={card}><p className="text-sm text-rose-700">{error}</p></div></Shell>;
  if (!rows || !catalog) return <Shell L={L}><p className="text-sm text-slate-500">{L('Cargando…', 'Loading…')}</p></Shell>;

  if (visit) return (
    <Shell L={L} compact>
      <Editor visit={visit} catalog={catalog} editable={editable && !!me?.canWrite} step={step} setStep={setStep} change={change} save={save} saving={saving} msg={msg} setMsg={setMsg}
        locate={() => locate()} close={close} setVisit={setVisit} L={L} locale={locale} />
    </Shell>
  );

  const countries = Array.from(new Set(rows.map(r => r.store.country).filter(Boolean)));
  const shown = rows.filter(r => (!filter.country || r.store.country === filter.country) && (!filter.mine || r.by.id === me?.id)
    && (!filter.q || `${r.store.name} ${r.store.chain} ${r.store.city}`.toLowerCase().includes(filter.q.toLowerCase())));

  return (
    <Shell L={L}>
      <div className="flex flex-wrap gap-2">
        {me?.canWrite && <button className={btn} onClick={start}>{L('+ Nueva visita (check-in)', '+ New visit (check-in)')}</button>}
        <a className={ghost} href="/api/store-checks?csv=1">{L('Descargar Excel (CSV)', 'Download Excel (CSV)')}</a>
        {me?.manager && <button className={ghost} onClick={() => setShowCatalog(s => !s)}>{L('Productos y competencia', 'Products and competitors')}</button>}
      </div>
      {draft && !draft.id && draft.store.name && (
        <div className={`${card} mt-3 border-amber-300 bg-amber-50`}>
          <p className="text-sm text-amber-900">{L('Tienes una visita sin subir en este teléfono:', 'You have an unsent visit on this phone:')} <b>{draft.store.name}</b></p>
          <div className="mt-2 flex gap-2"><button className={btn} onClick={() => { setVisit(draft); setEditable(true); setStep('tienda'); }}>{L('Seguir', 'Continue')}</button><button className={ghost} onClick={() => { if (confirm(L('¿Descartar esta visita sin subir?', 'Discard this unsent visit?'))) { writeDraft(null); setDraft(null); } }}>{L('Descartar', 'Discard')}</button></div>
        </div>
      )}
      {showCatalog && <CatalogEditor catalog={catalog} onSaved={c => { setCatalog(c); setShowCatalog(false); }} L={L} />}

      <div className="mt-4 flex flex-wrap gap-2">
        <input className={`${input} max-w-xs`} placeholder={L('Buscar tienda, cadena o ciudad', 'Search store, chain or city')} value={filter.q} onChange={e => setFilter(f => ({ ...f, q: e.target.value }))} />
        <select className={`${input} w-auto`} value={filter.country} onChange={e => setFilter(f => ({ ...f, country: e.target.value }))}>
          <option value="">{L('Todos los países', 'All countries')}</option>{countries.map(c => <option key={c}>{c}</option>)}
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={filter.mine} onChange={e => setFilter(f => ({ ...f, mine: e.target.checked }))} />{L('Solo mías', 'Mine only')}</label>
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-2">
        {shown.length === 0 && <p className="text-sm text-slate-500">{L('Todavía no hay visitas.', 'No visits yet.')}</p>}
        {shown.map(r => (
          <button key={r.id} onClick={() => open(r.id)} className={`${card} text-left hover:border-[#0a3fbf]`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="font-semibold text-[#0b1f4d]">{r.store.name}</p>
                <p className="text-xs text-slate-500">{[r.store.chain, r.store.city, r.store.country].filter(Boolean).join(' · ')}</p>
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${r.status === 'cerrada' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{r.status === 'cerrada' ? L('Cerrada', 'Closed') : L('Abierta', 'Open')}</span>
            </div>
            <p className="mt-1 text-xs text-slate-500">{new Date(r.checkIn).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' })} · {r.by.name}</p>
            <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
              <Chip>{L('Presentes', 'Present')} {r.summary.present}/{r.summary.products}</Chip>
              {r.summary.missing > 0 && <Chip bad>{L('Faltan', 'Missing')} {r.summary.missing}</Chip>}
              {r.summary.outOfStock > 0 && <Chip bad>{L('Agotados', 'Out of stock')} {r.summary.outOfStock}</Chip>}
              <Chip>{L('1.ª posición', '1st position')} {r.summary.firstPosition}</Chip>
              <Chip>{L('Frentes', 'Facings')} {r.summary.facings}</Chip>
              <Chip>📷 {r.summary.photos}</Chip>
              {r.photosPending && <Chip bad>{L('Faltan fotos', 'Photos pending')}</Chip>}
              {r.score != null && <Chip>★ {r.score}/5</Chip>}
            </div>
          </button>
        ))}
      </div>
    </Shell>
  );
}

function Shell({ children, L, compact }: { children: React.ReactNode; L: (es: string, en: string) => string; compact?: boolean }) {
  return (
    <div className="mx-auto max-w-5xl space-y-4 px-4 pb-28 pt-4 sm:px-6">
      {!compact && <PageHero title="Store check" subtitle={L('Visitas a tienda: presencia, espacio, precio, frío, competencia y fotos.', 'Store visits: presence, space, price, cooler, competitors and photos.')} />}
      {children}
    </div>
  );
}
const Chip = ({ children, bad }: { children: React.ReactNode; bad?: boolean }) => <span className={`rounded-full px-2 py-0.5 font-semibold ${bad ? 'bg-rose-100 text-rose-800' : 'bg-[#f2f6fd] text-[#0a3fbf]'}`}>{children}</span>;

/* ---------- controles ---------- */
function Choice<T extends string>({ value, options, onChange, labels, disabled }: { value: T | ''; options: readonly T[]; onChange: (v: T | '') => void; labels: Record<string, string>; disabled?: boolean }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map(o => (
        <button key={o} type="button" disabled={disabled} onClick={() => onChange(value === o ? '' : o)}
          className={`rounded-xl border px-3 py-2 text-sm font-medium ${value === o ? 'border-[#0a3fbf] bg-[#0a3fbf] text-white' : 'border-[#dbe4f3] bg-white text-slate-700'}`}>{labels[o] || o}</button>
      ))}
    </div>
  );
}
function YesNo({ value, onChange, L, disabled }: { value: Tri; onChange: (v: Tri) => void; L: (es: string, en: string) => string; disabled?: boolean }) {
  return <Choice value={value === true ? 'si' : value === false ? 'no' : ''} options={['si', 'no'] as const} labels={{ si: L('Sí', 'Yes'), no: 'No' }} onChange={v => onChange(v === 'si' ? true : v === 'no' ? false : null)} disabled={disabled} />;
}
function Num({ value, onChange, placeholder, disabled, step = 'any' }: { value: number | null; onChange: (v: number | null) => void; placeholder?: string; disabled?: boolean; step?: string }) {
  const [txt, setTxt] = useState(value == null ? '' : String(value));
  useEffect(() => { setTxt(t => (Number(t.replace(',', '.')) === value ? t : value == null ? '' : String(value))); }, [value]);
  return <input className={input} inputMode="decimal" step={step} placeholder={placeholder} disabled={disabled} value={txt}
    onChange={e => { setTxt(e.target.value); const n = Number(e.target.value.replace(',', '.')); onChange(e.target.value.trim() === '' || !Number.isFinite(n) ? null : n); }} />;
}
const Field = ({ label, children }: { label: string; children: React.ReactNode }) => <div><span className={lbl}>{label}</span>{children}</div>;

/* ---------- editor de una visita ---------- */
function Editor({ visit, catalog, editable, step, setStep, change, save, saving, msg, setMsg, locate, close, setVisit, L, locale }: {
  visit: Visit; catalog: Catalog; editable: boolean; step: Step; setStep: (s: Step) => void; change: (fn: (v: Visit) => Visit) => void;
  save: (extra?: Partial<Visit>) => Promise<Visit | null>; saving: boolean; msg: { ok: boolean; text: string } | null; setMsg: (m: { ok: boolean; text: string } | null) => void;
  locate: () => void; close: () => void; setVisit: (v: Visit) => void; L: (es: string, en: string) => string; locale: string;
}) {
  const ro = !editable;
  const steps: [Step, string][] = [['tienda', L('1 Tienda', '1 Store')], ['productos', L('2 Productos', '2 Products')], ['frio', L('3 Frío y 2.º punto', '3 Cooler & 2nd spot')], ['competencia', L('4 Competencia', '4 Competitors')], ['fotos', L('5 Fotos', '5 Photos')], ['cierre', L('6 Cierre', '6 Wrap-up')]];
  const idx = steps.findIndex(s => s[0] === step);
  const T = useMemo(() => ({
    presence: { si: L('Sí está', 'Present'), no: L('No está', 'Not there'), agotado: L('Agotado (hueco)', 'Out of stock') },
    place: { gondola: L('Góndola', 'Gondola'), shelf: 'Shelf', punta: L('Punta', 'End cap'), caja: L('Caja', 'Checkout'), frio: L('Frío', 'Cooler'), piso: L('Piso / pallet', 'Floor / pallet') },
    position: { '1': L('1.ª', '1st'), '2': L('2.ª', '2nd'), '3+': L('3.ª o más', '3rd+') },
    height: { ojos: L('Ojos', 'Eye'), manos: L('Manos', 'Hand'), pies: L('Pies', 'Feet'), arriba: L('Arriba', 'Top') },
    condition: { bien: L('Bien', 'Good'), regular: 'Regular', mal: L('Mal', 'Bad') },
    owner: { nuestro: L('Nuestro', 'Ours'), tienda: L('De la tienda', "Store's"), competencia: L('Competencia', 'Competitor'), mixto: L('Mixto', 'Mixed') },
    spot: { punta: L('Punta de góndola', 'End cap'), caja: L('Caja', 'Checkout'), exhibidor: L('Exhibidor', 'Display'), isla: L('Isla', 'Island'), frio_caja: L('Frío en caja', 'Checkout cooler'), otro: L('Otro', 'Other') },
    tag: { general: 'General', producto: L('Producto', 'Product'), frio: L('Frío', 'Cooler'), competencia: L('Competencia', 'Competitor'), promo: 'Promo', segundo_punto: L('2.º punto', '2nd spot') },
  }), [L]);
  const setC = (i: number, patch: Partial<CompetitorCheck>) => change(v => ({ ...v, competitors: v.competitors.map((c, j) => (j === i ? { ...c, ...patch } : c)) }));
  const cat = new Map(catalog.products.map(p => [p.id, p]));
  // Tarjetas de producto: abiertas las que faltan por revisar; se quedan como la persona las deje.
  const [opened, setOpened] = useState<Record<string, boolean>>({});
  const isOpen = (id: string, dflt: boolean) => opened[id] ?? dflt;
  const toggle = (id: string, dflt: boolean) => setOpened(o => ({ ...o, [id]: !(o[id] ?? dflt) }));
  const setP = (i: number, patch: Partial<ProductCheck>) => {
    const id = visit.products[i]?.productId;
    if (id && opened[id] === undefined) setOpened(o => ({ ...o, [id]: true }));
    change(v => ({ ...v, products: v.products.map((p, j) => (j === i ? { ...p, ...patch } : p)) }));
  };

  return (
    <div className="space-y-3">
      <div className="sticky top-0 z-20 -mx-4 bg-[#f6f8fc]/95 px-4 pb-2 pt-2 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="flex items-center justify-between gap-2">
          <button className={ghost} onClick={close}>← {L('Visitas', 'Visits')}</button>
          <p className="truncate text-sm font-semibold text-[#0b1f4d]">{visit.store.name || L('Visita nueva', 'New visit')}</p>
          {editable && <button className={btn} disabled={saving} onClick={() => save()}>{saving ? '…' : L('Guardar', 'Save')}</button>}
        </div>
        <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
          {steps.map(([k, t]) => <button key={k} onClick={() => setStep(k)} className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold ${step === k ? 'bg-[#0a3fbf] text-white' : 'bg-white text-[#0a3fbf] border border-[#dbe4f3]'}`}>{t}</button>)}
        </div>
        {msg && <p className={`mt-1 text-sm ${msg.ok ? 'text-emerald-700' : 'text-rose-700'}`} role="status">{msg.text}</p>}
        {ro && <p className="mt-1 text-xs text-slate-500">{L('Solo lectura: esta visita la hizo otra persona.', 'Read only: someone else made this visit.')}</p>}
      </div>

      {step === 'tienda' && (
        <div className={`${card} space-y-3`}>
          <Field label={L('Nombre de la tienda *', 'Store name *')}><input className={input} disabled={ro} value={visit.store.name} onChange={e => change(v => ({ ...v, store: { ...v.store, name: e.target.value } }))} placeholder={L('Ej.: Riba Smith Costa del Este', 'e.g. Publix Brickell')} /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={L('Cadena', 'Chain')}><input className={input} disabled={ro} value={visit.store.chain} onChange={e => change(v => ({ ...v, store: { ...v.store, chain: e.target.value } }))} /></Field>
            <Field label={L('Tipo de tienda', 'Store type')}><select className={input} disabled={ro} value={visit.store.channel} onChange={e => change(v => ({ ...v, store: { ...v.store, channel: e.target.value } }))}><option value="">—</option>{CHANNELS.map(c => <option key={c}>{c}</option>)}</select></Field>
            <Field label={L('País', 'Country')}><select className={input} disabled={ro} value={visit.store.country} onChange={e => change(v => ({ ...v, store: { ...v.store, country: e.target.value } }))}>{COUNTRIES.map(c => <option key={c}>{c}</option>)}</select></Field>
            <Field label={L('Ciudad / zona', 'City / area')}><input className={input} disabled={ro} value={visit.store.city} onChange={e => change(v => ({ ...v, store: { ...v.store, city: e.target.value } }))} /></Field>
          </div>
          <Field label={L('Dirección o referencia', 'Address or landmark')}><input className={input} disabled={ro} value={visit.store.address} onChange={e => change(v => ({ ...v, store: { ...v.store, address: e.target.value } }))} /></Field>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={L('Encargado / contacto en tienda', 'Store contact')}><input className={input} disabled={ro} value={visit.store.contact} onChange={e => change(v => ({ ...v, store: { ...v.store, contact: e.target.value } }))} /></Field>
            <Field label={L('Teléfono del contacto', 'Contact phone')}><input className={input} disabled={ro} inputMode="tel" value={visit.store.contactPhone} onChange={e => change(v => ({ ...v, store: { ...v.store, contactPhone: e.target.value } }))} /></Field>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
            <span>📍 {visit.location ? <a className="underline" target="_blank" rel="noreferrer" href={`https://maps.google.com/?q=${visit.location.lat},${visit.location.lng}`}>{visit.location.lat.toFixed(5)}, {visit.location.lng.toFixed(5)}</a> : L('Sin ubicación', 'No location')}{visit.location?.accuracy ? ` (±${visit.location.accuracy} m)` : ''}</span>
            {editable && <button className={ghost} onClick={locate}>{L('Tomar ubicación', 'Get location')}</button>}
          </div>
          <p className="text-xs text-slate-500">{L('Entrada', 'Check-in')}: {new Date(visit.checkIn).toLocaleString(locale, { dateStyle: 'medium', timeStyle: 'short' })}{visit.by.name ? ` · ${visit.by.name}` : ''}</p>
        </div>
      )}

      {step === 'productos' && (
        <div className="space-y-3">
          {visit.products.length === 0 && <p className="text-sm text-slate-500">{L('No hay productos en el catálogo.', 'No products in the catalog.')}</p>}
          {visit.products.map((p, i) => {
            const c = cat.get(p.productId); const flavors = c?.flavors || [];
            return (
              <div key={p.productId || i} className={card} data-product={p.productId}>
                <button type="button" aria-expanded={isOpen(p.productId, !p.presence)} onClick={() => toggle(p.productId, !p.presence)} className="flex w-full items-center justify-between gap-2 text-left">
                  <span className="font-semibold text-[#0b1f4d]">{p.name}{p.brand && p.brand !== p.name ? <span className="font-normal text-slate-500"> · {p.brand}</span> : null}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${p.presence === 'si' ? 'bg-emerald-100 text-emerald-800' : p.presence ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-600'}`}>{p.presence ? (T.presence as Record<string, string>)[p.presence] : L('Sin revisar', 'Not checked')}</span>
                </button>
                {isOpen(p.productId, !p.presence) && <div className="mt-3 space-y-3">
                  <Field label={L('¿Hay presencia?', 'Is it on shelf?')}><Choice value={p.presence} options={PRESENCE} labels={T.presence} disabled={ro} onChange={x => setP(i, { presence: x })} /></Field>
                  {p.presence === 'si' && <>
                    <Field label={L('¿Dónde?', 'Where?')}><Choice value={p.place} options={PLACES} labels={T.place} disabled={ro} onChange={x => setP(i, { place: x })} /></Field>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label={L('Posición en la categoría', 'Position in category')}><Choice value={p.position} options={POSITIONS} labels={T.position} disabled={ro} onChange={x => setP(i, { position: x })} /></Field>
                      <Field label={L('Altura', 'Shelf level')}><Choice value={p.height} options={HEIGHTS} labels={T.height} disabled={ro} onChange={x => setP(i, { height: x })} /></Field>
                    </div>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      <Field label={L('Frentes', 'Facings')}><Num value={p.facings} disabled={ro} onChange={x => setP(i, { facings: x })} /></Field>
                      <Field label={L('% del espacio', '% of space')}><Num value={p.shelfShare} disabled={ro} onChange={x => setP(i, { shelfShare: x })} /></Field>
                      <Field label={L('Precio en estante', 'Shelf price')}><Num value={p.price} disabled={ro} placeholder={c?.suggestedPrice != null ? `${L('sug.', 'sugg.')} ${c.suggestedPrice}` : ''} onChange={x => setP(i, { price: x })} /></Field>
                      <Field label={L('Vence (más cercano)', 'Nearest expiry')}><input className={input} type="date" disabled={ro} value={p.expiry} onChange={e => setP(i, { expiry: e.target.value })} /></Field>
                    </div>
                    <Field label={`${L('Sabores / presentaciones vistos', 'Flavors / sizes seen')} (${p.flavorsFound.length}${flavors.length ? `/${flavors.length}` : ''})`}>
                      {flavors.length ? (
                        <div className="flex flex-wrap gap-1.5">{flavors.map(f => { const on = p.flavorsFound.includes(f); return <button key={f} type="button" disabled={ro} onClick={() => setP(i, { flavorsFound: on ? p.flavorsFound.filter(x => x !== f) : [...p.flavorsFound, f] })} className={`rounded-xl border px-3 py-1.5 text-sm ${on ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-[#dbe4f3] bg-white text-slate-700'}`}>{f}</button>; })}</div>
                      ) : (
                        <input className={input} disabled={ro} placeholder={L('Escribe separados por coma', 'Comma separated')} value={p.flavorsFound.join(', ')} onChange={e => setP(i, { flavorsFound: e.target.value.split(',').map(s => s.trim()).filter((s, k, a) => s || k === a.length - 1) })} />
                      )}
                    </Field>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <Field label={L('¿Precio comunicado (etiqueta)?', 'Price tag shown?')}><YesNo value={p.priceTag} disabled={ro} L={L} onChange={x => setP(i, { priceTag: x })} /></Field>
                      <Field label={L('¿Promoción comunicada?', 'Promotion shown?')}><YesNo value={p.promo} disabled={ro} L={L} onChange={x => setP(i, { promo: x })} /></Field>
                    </div>
                    {p.promo && <Field label={L('¿Qué promoción?', 'Which promotion?')}><input className={input} disabled={ro} value={p.promoDetail} placeholder={L('2x1, % descuento, combo…', 'BOGO, % off, bundle…')} onChange={e => setP(i, { promoDetail: e.target.value })} /></Field>}
                    <div className="grid gap-3 sm:grid-cols-3">
                      <Field label={L('¿Hay en frío?', 'In cooler?')}><YesNo value={p.inCold} disabled={ro} L={L} onChange={x => setP(i, { inCold: x })} /></Field>
                      <Field label={L('¿Inventario en bodega?', 'Backstock?')}><YesNo value={p.backstock} disabled={ro} L={L} onChange={x => setP(i, { backstock: x })} /></Field>
                      <Field label={L('Estado del producto', 'Product condition')}><Choice value={p.condition} options={CONDITIONS} labels={T.condition} disabled={ro} onChange={x => setP(i, { condition: x })} /></Field>
                    </div>
                  </>}
                  <Field label={L('Notas', 'Notes')}><textarea className={input} rows={2} disabled={ro} value={p.notes} onChange={e => setP(i, { notes: e.target.value })} /></Field>
                </div>}
              </div>
            );
          })}
        </div>
      )}

      {step === 'frio' && (
        <div className="space-y-3">
          <div className={`${card} space-y-3`}>
            <p className="font-semibold text-[#0b1f4d]">{L('Frío', 'Cooler')}</p>
            <Field label={L('¿Hay producto nuestro en frío?', 'Is our product in a cooler?')}><YesNo value={visit.cold.has} disabled={ro} L={L} onChange={x => change(v => ({ ...v, cold: { ...v.cold, has: x } }))} /></Field>
            {visit.cold.has && <>
              <Field label={L('¿De quién es el frío?', 'Whose cooler is it?')}><Choice value={visit.cold.owner} options={COLD_OWNERS} labels={T.owner} disabled={ro} onChange={x => change(v => ({ ...v, cold: { ...v.cold, owner: x } }))} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label={L('Puertas / bandejas', 'Doors / shelves')}><Num value={visit.cold.doors} disabled={ro} onChange={x => change(v => ({ ...v, cold: { ...v.cold, doors: x } }))} /></Field>
                <Field label={L('% nuestro en el frío', '% ours in cooler')}><Num value={visit.cold.ourShare} disabled={ro} onChange={x => change(v => ({ ...v, cold: { ...v.cold, ourShare: x } }))} /></Field>
              </div>
              {visit.cold.owner === 'nuestro' && <div className="grid gap-3 sm:grid-cols-3">
                <Field label={L('¿Tiene producto ajeno?', 'Foreign product inside?')}><YesNo value={visit.cold.foreignInOurs} disabled={ro} L={L} onChange={x => change(v => ({ ...v, cold: { ...v.cold, foreignInOurs: x } }))} /></Field>
                <Field label={L('¿Funciona (enfría)?', 'Working (cold)?')}><YesNo value={visit.cold.working} disabled={ro} L={L} onChange={x => change(v => ({ ...v, cold: { ...v.cold, working: x } }))} /></Field>
                <Field label={L('¿Limpio y ordenado?', 'Clean and tidy?')}><YesNo value={visit.cold.clean} disabled={ro} L={L} onChange={x => change(v => ({ ...v, cold: { ...v.cold, clean: x } }))} /></Field>
              </div>}
            </>}
            <Field label={L('Notas del frío', 'Cooler notes')}><textarea className={input} rows={2} disabled={ro} value={visit.cold.notes} onChange={e => change(v => ({ ...v, cold: { ...v.cold, notes: e.target.value } }))} /></Field>
          </div>
          <div className={`${card} space-y-3`}>
            <p className="font-semibold text-[#0b1f4d]">{L('Segundos puntos de venta', 'Secondary placements')}</p>
            <Field label={L('¿Hay segundo punto?', 'Any secondary spot?')}><YesNo value={visit.secondary.has} disabled={ro} L={L} onChange={x => change(v => ({ ...v, secondary: { ...v.secondary, has: x } }))} /></Field>
            {visit.secondary.has && <Field label={L('¿Dónde? (varios)', 'Where? (multiple)')}>
              <div className="flex flex-wrap gap-1.5">{SECOND_SPOTS.map(s => { const on = visit.secondary.where.includes(s); return <button key={s} type="button" disabled={ro} onClick={() => change(v => ({ ...v, secondary: { ...v.secondary, where: on ? v.secondary.where.filter(x => x !== s) : [...v.secondary.where, s] } }))} className={`rounded-xl border px-3 py-2 text-sm ${on ? 'border-[#0a3fbf] bg-[#0a3fbf] text-white' : 'border-[#dbe4f3] bg-white text-slate-700'}`}>{(T.spot as Record<string, string>)[s]}</button>; })}</div>
            </Field>}
            <Field label={L('Notas', 'Notes')}><textarea className={input} rows={2} disabled={ro} value={visit.secondary.notes} onChange={e => change(v => ({ ...v, secondary: { ...v.secondary, notes: e.target.value } }))} /></Field>
          </div>
          <div className={`${card} space-y-3`}>
            <p className="font-semibold text-[#0b1f4d]">{L('Material de punto de venta (afiches, exhibidores)', 'POS material (posters, displays)')}</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={L('¿Hay material nuestro?', 'Ours?')}><YesNo value={visit.pop.ours} disabled={ro} L={L} onChange={x => change(v => ({ ...v, pop: { ...v.pop, ours: x } }))} /></Field>
              <Field label={L('¿Hay de la competencia?', "Competitors'?")}><YesNo value={visit.pop.competitors} disabled={ro} L={L} onChange={x => change(v => ({ ...v, pop: { ...v.pop, competitors: x } }))} /></Field>
            </div>
            <Field label={L('Notas', 'Notes')}><textarea className={input} rows={2} disabled={ro} value={visit.pop.notes} onChange={e => change(v => ({ ...v, pop: { ...v.pop, notes: e.target.value } }))} /></Field>
          </div>
        </div>
      )}

      {step === 'competencia' && (
        <div className="space-y-3">
          {visit.competitors.map((c, i) => (
            <div key={c.id} className={`${card} space-y-3`}>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label={L('Marca', 'Brand')}><input className={input} disabled={ro} list="sc-comp" value={c.brand} onChange={e => { const b = e.target.value; const k = catalog.competitors.find(x => x.brand === b); setC(i, { brand: b, ...(k && !c.category ? { category: k.category } : {}) }); }} /></Field>
                <Field label={L('Producto / presentación', 'Product / size')}><input className={input} disabled={ro} value={c.product} onChange={e => setC(i, { product: e.target.value })} /></Field>
                <Field label={L('Categoría', 'Category')}><input className={input} disabled={ro} value={c.category} onChange={e => setC(i, { category: e.target.value })} /></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label={L('Precio', 'Price')}><Num value={c.price} disabled={ro} onChange={x => setC(i, { price: x })} /></Field>
                <Field label={L('Frentes', 'Facings')}><Num value={c.facings} disabled={ro} onChange={x => setC(i, { facings: x })} /></Field>
              </div>
              <Field label={L('Posición', 'Position')}><Choice value={c.position} options={POSITIONS} labels={T.position} disabled={ro} onChange={x => setC(i, { position: x })} /></Field>
              <div className="grid gap-3 sm:grid-cols-3">
                <Field label={L('¿Promoción?', 'Promotion?')}><YesNo value={c.promo} disabled={ro} L={L} onChange={x => setC(i, { promo: x })} /></Field>
                <Field label={L('¿En frío?', 'In cooler?')}><YesNo value={c.inCold} disabled={ro} L={L} onChange={x => setC(i, { inCold: x })} /></Field>
                <Field label={L('¿Lanzamiento nuevo?', 'New launch?')}><YesNo value={c.newLaunch} disabled={ro} L={L} onChange={x => setC(i, { newLaunch: x })} /></Field>
              </div>
              {c.promo && <Field label={L('¿Qué promoción?', 'Which promotion?')}><input className={input} disabled={ro} value={c.promoDetail} onChange={e => setC(i, { promoDetail: e.target.value })} /></Field>}
              <Field label={L('Notas', 'Notes')}><textarea className={input} rows={2} disabled={ro} value={c.notes} onChange={e => setC(i, { notes: e.target.value })} /></Field>
              {editable && <button className="text-sm font-semibold text-rose-700" onClick={() => change(v => ({ ...v, competitors: v.competitors.filter((_, j) => j !== i) }))}>{L('Quitar', 'Remove')}</button>}
            </div>
          ))}
          <datalist id="sc-comp">{catalog.competitors.map(c => <option key={c.brand} value={c.brand}>{c.category}</option>)}</datalist>
          {editable && <button className={ghost} onClick={() => change(v => ({ ...v, competitors: [...v.competitors, emptyCompetitor()] }))}>{L('+ Añadir producto de la competencia', '+ Add competitor product')}</button>}
        </div>
      )}

      {step === 'fotos' && <Photos visit={visit} editable={editable} save={save} setVisit={setVisit} change={change} setMsg={setMsg} T={T.tag} L={L} />}

      {step === 'cierre' && (
        <div className={`${card} space-y-3`}>
          <Field label={L('Nota general de ejecución en la tienda', 'Overall execution score')}>
            <div className="flex gap-1.5">{[1, 2, 3, 4, 5].map(n => <button key={n} type="button" disabled={ro} onClick={() => change(v => ({ ...v, score: v.score === n ? null : n }))} className={`h-11 w-11 rounded-xl border text-lg ${visit.score != null && n <= visit.score ? 'border-amber-400 bg-amber-400 text-white' : 'border-[#dbe4f3] bg-white text-slate-400'}`}>★</button>)}</div>
          </Field>
          <Field label={L('Comentarios generales', 'General comments')}><textarea className={input} rows={3} disabled={ro} value={visit.notes} onChange={e => change(v => ({ ...v, notes: e.target.value }))} /></Field>
          <Field label={L('Pendientes / seguimiento (uno por línea)', 'Follow-ups (one per line)')}><textarea className={input} rows={3} disabled={ro} value={visit.followUps} placeholder={L('Hablar con el encargado por el frío…', 'Talk to the manager about the cooler…')} onChange={e => change(v => ({ ...v, followUps: e.target.value }))} /></Field>
          <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" disabled={ro} checked={visit.photosPending} onChange={e => change(v => ({ ...v, photosPending: e.target.checked }))} />{L('Faltan fotos (las subo después)', 'Photos pending (upload later)')}</label>
          <Summary visit={visit} catalog={catalog} L={L} />
          {editable && (
            <div className="flex flex-wrap gap-2 pt-1">
              {visit.status === 'abierta'
                ? <button className={btn} disabled={saving} onClick={async () => { const v = await save({ status: 'cerrada' }); if (v) close(); }}>{L('Cerrar visita (check-out)', 'Close visit (check-out)')}</button>
                : <button className={ghost} disabled={saving} onClick={() => save({ status: 'abierta' })}>{L('Reabrir', 'Reopen')}</button>}
              {visit.id && <button className="rounded-xl px-3 py-2 text-sm font-semibold text-rose-700" onClick={async () => {
                if (!confirm(L('¿Borrar esta visita y sus fotos?', 'Delete this visit and its photos?'))) return;
                const r = await fetch('/api/store-checks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete', id: visit.id }) });
                if (r.ok) { writeDraft(null); close(); } else setMsg({ ok: false, text: (await r.json().catch(() => ({}))).error || L('No se pudo borrar.', 'Could not delete.') });
              }}>{L('Borrar visita', 'Delete visit')}</button>}
            </div>
          )}
        </div>
      )}

      {idx >= 0 && (
        <div className="flex justify-between gap-2">
          <button className={ghost} disabled={idx === 0} onClick={() => setStep(steps[idx - 1][0])}>← {L('Atrás', 'Back')}</button>
          {idx < steps.length - 1 && <button className={ghost} onClick={async () => { if (editable && visit.store.name.trim()) save(); setStep(steps[idx + 1][0]); }}>{L('Siguiente', 'Next')} →</button>}
        </div>
      )}
    </div>
  );
}

function Summary({ visit, catalog, L }: { visit: Visit; catalog: Catalog; L: (es: string, en: string) => string }) {
  const checked = visit.products.filter(p => p.presence);
  const present = checked.filter(p => p.presence === 'si');
  const sug = new Map(catalog.products.map(p => [p.id, p.suggestedPrice]));
  return (
    <div className="rounded-xl bg-[#f2f6fd] p-3 text-sm text-[#0b1f4d]">
      <p className="font-semibold">{L('Resumen', 'Summary')}</p>
      <p>{L('Presentes', 'Present')}: {present.length}/{checked.length} · {L('1.ª posición', '1st position')}: {present.filter(p => p.position === '1').length} · {L('Frentes', 'Facings')}: {present.reduce((a, p) => a + (p.facings || 0), 0)} · {L('Con promo', 'With promo')}: {present.filter(p => p.promo).length}</p>
      {checked.filter(p => p.presence !== 'si').map(p => <p key={p.productId} className="text-rose-700">• {p.presence === 'no' ? L('No está', 'Not there') : L('Agotado', 'Out of stock')}: {p.name}</p>)}
      {present.filter(p => { const s = sug.get(p.productId); return s != null && p.price != null && Math.abs(p.price - s) / s > 0.05; }).map(p => <p key={p.productId} className="text-amber-700">• {L('Precio distinto al sugerido', 'Price differs from suggested')}: {p.name} ({p.price} vs {sug.get(p.productId)})</p>)}
      {visit.products.some(p => !p.presence) && <p className="text-slate-500">{L('Sin revisar', 'Not checked')}: {visit.products.filter(p => !p.presence).map(p => p.name).join(', ')}</p>}
    </div>
  );
}

/* ---------- fotos ---------- */
function Photos({ visit, editable, save, setVisit, change, setMsg, T, L }: {
  visit: Visit; editable: boolean; save: (extra?: Partial<Visit>) => Promise<Visit | null>; setVisit: (v: Visit) => void; change: (fn: (v: Visit) => Visit) => void;
  setMsg: (m: { ok: boolean; text: string } | null) => void; T: Record<string, string>; L: (es: string, en: string) => string;
}) {
  const [tag, setTag] = useState<string>('general');
  const [productId, setProductId] = useState('');
  const [busy, setBusy] = useState('');
  const cam = useRef<HTMLInputElement>(null), gal = useRef<HTMLInputElement>(null);

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    let v: Visit | null = visit;
    if (!v.id) { v = await save(); if (!v) return; }
    let done = 0, failed = 0, last: Visit | null = null;
    for (const f of Array.from(files)) {
      setBusy(`${L('Subiendo', 'Uploading')} ${done + failed + 1}/${files.length}…`);
      try {
        const fd = new FormData(); fd.set('visit', v.id); fd.set('tag', tag); fd.set('productId', productId);
        const blob = await shrink(f); fd.set('file', blob, f.name.replace(/\.\w+$/, '') + (blob.type === 'image/jpeg' ? '.jpg' : ''));
        const r = await fetch('/api/store-checks/photo', { method: 'POST', body: fd }); const d = await r.json().catch(() => ({}));
        if (r.ok) { done++; last = d.visit; } else { failed++; setMsg({ ok: false, text: d.error || L('No se pudo subir una foto.', 'A photo failed to upload.') }); }
      } catch { failed++; setMsg({ ok: false, text: L('Sin señal: marca «Faltan fotos» y súbelas después.', 'No signal: tick “Photos pending” and upload later.') }); }
    }
    if (last) setVisit({ ...visit, id: last.id, photos: last.photos, updatedAt: last.updatedAt });
    setBusy(''); if (done && !failed) setMsg({ ok: true, text: `${done} ${L('foto(s) subida(s).', 'photo(s) uploaded.')}` });
    if (cam.current) cam.current.value = ''; if (gal.current) gal.current.value = '';
  }
  async function remove(id: string) {
    if (!confirm(L('¿Borrar esta foto?', 'Delete this photo?'))) return;
    const r = await fetch('/api/store-checks/photo', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'delete', visit: visit.id, id }) });
    const d = await r.json().catch(() => ({})); if (r.ok) setVisit({ ...visit, photos: d.visit.photos }); else setMsg({ ok: false, text: d.error });
  }
  const names = new Map(visit.products.map(p => [p.productId, p.name]));

  return (
    <div className="space-y-3">
      {editable && (
        <div className={`${card} space-y-3`}>
          <Field label={L('¿De qué es la foto?', 'What is the photo of?')}><Choice value={tag} options={PHOTO_TAGS} labels={T} onChange={x => setTag(x || 'general')} /></Field>
          {tag === 'producto' && <Field label={L('Producto', 'Product')}><select className={input} value={productId} onChange={e => setProductId(e.target.value)}><option value="">—</option>{visit.products.map(p => <option key={p.productId} value={p.productId}>{p.name}</option>)}</select></Field>}
          <div className="flex flex-wrap gap-2">
            <button className={btn} disabled={!!busy} onClick={() => cam.current?.click()}>📷 {L('Tomar foto', 'Take photo')}</button>
            <button className={ghost} disabled={!!busy} onClick={() => gal.current?.click()}>{L('Elegir de la galería', 'Choose from gallery')}</button>
          </div>
          <input ref={cam} type="file" accept="image/*" capture="environment" className="hidden" onChange={e => upload(e.target.files)} />
          <input ref={gal} type="file" accept="image/*" multiple className="hidden" onChange={e => upload(e.target.files)} />
          {busy && <p className="text-sm text-slate-600">{busy}</p>}
          <label className="flex items-center gap-2 text-sm text-slate-700"><input type="checkbox" checked={visit.photosPending} onChange={e => change(v => ({ ...v, photosPending: e.target.checked }))} />{L('Faltan fotos (las subo después)', 'Photos pending (upload later)')}</label>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {visit.photos.length === 0 && <p className="col-span-full text-sm text-slate-500">{L('Sin fotos todavía.', 'No photos yet.')}</p>}
        {visit.photos.map(p => {
          const src = `/api/store-checks/photo?visit=${encodeURIComponent(visit.id)}&id=${encodeURIComponent(p.id)}`;
          return (
            <div key={p.id} className="overflow-hidden rounded-xl border border-[#dbe4f3] bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <a href={src} target="_blank" rel="noreferrer"><img src={src} alt={p.caption || T[p.tag]} loading="lazy" className="h-32 w-full object-cover" /></a>
              <div className="flex items-center justify-between gap-1 px-2 py-1 text-[11px] text-slate-600">
                <span className="truncate">{T[p.tag]}{p.productId && names.get(p.productId) ? ` · ${names.get(p.productId)}` : ''}</span>
                {editable && <button className="font-semibold text-rose-700" onClick={() => remove(p.id)} aria-label={L('Borrar foto', 'Delete photo')}>✕</button>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- catálogo (gerencia) ---------- */
function CatalogEditor({ catalog, onSaved, L }: { catalog: Catalog; onSaved: (c: Catalog) => void; L: (es: string, en: string) => string }) {
  const [products, setProducts] = useState(catalog.products.map(p => ({ ...p, flavorsTxt: p.flavors.join(', '), priceTxt: p.suggestedPrice == null ? '' : String(p.suggestedPrice) })));
  const [comp, setComp] = useState(catalog.competitors.map(c => `${c.brand}${c.category ? ` | ${c.category}` : ''}`).join('\n'));
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const set = (i: number, patch: Record<string, unknown>) => setProducts(ps => ps.map((p, j) => (j === i ? { ...p, ...patch } : p)));
  async function save() {
    setBusy(true); setErr('');
    const body = {
      products: products.map(p => ({ id: p.id, brand: p.brand, name: p.name, category: p.category, active: p.active, flavors: p.flavorsTxt.split(',').map(s => s.trim()).filter(Boolean), suggestedPrice: p.priceTxt.trim() === '' ? null : Number(p.priceTxt.replace(',', '.')) })),
      competitors: comp.split('\n').map(l => { const [brand, category] = l.split('|').map(s => s.trim()); return { brand, category: category || '' }; }).filter(c => c.brand),
    };
    const r = await fetch('/api/store-checks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'catalog', catalog: body }) });
    const d = await r.json().catch(() => ({})); setBusy(false);
    if (r.ok) onSaved(d.catalog); else setErr(d.error || L('No se pudo guardar.', 'Could not save.'));
  }
  return (
    <div className={`${card} mt-3 space-y-3`}>
      <p className="font-semibold text-[#0b1f4d]">{L('Productos de SM que se revisan en cada visita', 'SM products checked on each visit')}</p>
      <p className="text-xs text-slate-500">{L('Sabores o presentaciones separados por coma. El precio sugerido sirve para avisar cuando el precio en estante es distinto (más de 5 %).', 'Flavors or sizes comma separated. Suggested price flags shelf prices more than 5% off.')}</p>
      {products.map((p, i) => (
        <div key={p.id || i} className="grid gap-2 rounded-xl border border-[#dbe4f3] p-2 sm:grid-cols-[1fr_1fr_1fr_2fr_90px_auto]">
          <input className={input} placeholder={L('Marca', 'Brand')} value={p.brand} onChange={e => set(i, { brand: e.target.value })} />
          <input className={input} placeholder={L('Producto', 'Product')} value={p.name} onChange={e => set(i, { name: e.target.value })} />
          <input className={input} placeholder={L('Categoría', 'Category')} value={p.category} onChange={e => set(i, { category: e.target.value })} />
          <input className={input} placeholder={L('Sabores / presentaciones', 'Flavors / sizes')} value={p.flavorsTxt} onChange={e => set(i, { flavorsTxt: e.target.value })} />
          <input className={input} inputMode="decimal" placeholder={L('Precio sug.', 'Sugg. price')} value={p.priceTxt} onChange={e => set(i, { priceTxt: e.target.value })} />
          <label className="flex items-center gap-1 text-xs text-slate-600"><input type="checkbox" checked={p.active} onChange={e => set(i, { active: e.target.checked })} />{L('Activo', 'Active')}</label>
        </div>
      ))}
      <button className={ghost} onClick={() => setProducts(ps => [...ps, { id: '', brand: '', name: '', category: '', flavors: [], suggestedPrice: null, active: true, flavorsTxt: '', priceTxt: '' }])}>{L('+ Producto', '+ Product')}</button>
      <Field label={L('Competencia (una por línea: Marca | Categoría)', 'Competitors (one per line: Brand | Category)')}><textarea className={input} rows={4} value={comp} onChange={e => setComp(e.target.value)} placeholder={'Coca-Cola | Refrescos\nDel Valle | Jugos'} /></Field>
      {err && <p className="text-sm text-rose-700">{err}</p>}
      <button className={btn} disabled={busy} onClick={save}>{L('Guardar catálogo', 'Save catalog')}</button>
    </div>
  );
}
