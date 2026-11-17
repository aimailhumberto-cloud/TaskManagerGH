'use client';
import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useUiLang } from '@/lib/uiLang';
import './BrainWelcome.css';

/** Marca por persona en este navegador: la bienvenida sale sola una única vez por cerebro. */
const seenKey = (brainId: string) => `smj.welcome.v1:${brainId || 'me'}`;
export function welcomeSeen(brainId: string): boolean { try { return localStorage.getItem(seenKey(brainId)) === '1'; } catch { return true; } } // sin almacenamiento no se insiste
export function markWelcomeSeen(brainId: string) { try { localStorage.setItem(seenKey(brainId), '1'); } catch {} }

const CORE = { x: 160, y: 122 };
// Cinco puntos numerados (uno por paso) y dos menores; brotan del núcleo en este orden.
const NODES: { x: number; y: number; n?: number }[] = [
  { x: 66, y: 62, n: 1 }, { x: 252, y: 50, n: 2 }, { x: 286, y: 146, n: 3 }, { x: 196, y: 212, n: 4 }, { x: 54, y: 176, n: 5 },
  { x: 150, y: 22 }, { x: 104, y: 222 },
];
const SYNAPSES: [number, number][] = [[0, 5], [5, 1], [1, 2], [2, 3], [3, 6], [6, 4], [4, 0]];

/** Ilustración propia: un núcleo que enciende y puntos que brotan y se conectan. Decorativa. */
function BirthArt() {
  return (
    <svg className="bw-art" viewBox="0 0 320 244" aria-hidden="true" focusable="false">
      {SYNAPSES.map(([a, b], i) => (
        <line key={i} className="bw-synapse" style={{ '--i': i } as React.CSSProperties} x1={NODES[a].x} y1={NODES[a].y} x2={NODES[b].x} y2={NODES[b].y} stroke="#9fdcff" strokeOpacity="0.38" strokeWidth="1.2" strokeDasharray="2 5" strokeLinecap="round" />
      ))}
      {NODES.map((p, i) => (
        <g key={i} className="bw-branch" style={{ '--i': i } as React.CSSProperties}>
          <line x1={CORE.x} y1={CORE.y} x2={p.x} y2={p.y} stroke={p.n ? '#00a8f0' : '#9fdcff'} strokeOpacity={p.n ? 0.9 : 0.55} strokeWidth={p.n ? 2 : 1.4} strokeLinecap="round" />
          {p.n ? (<>
            <circle cx={p.x} cy={p.y} r="15" fill="#0b1f4d" stroke="#00a8f0" strokeWidth="2" />
            <text x={p.x} y={p.y + 4.5} textAnchor="middle" fontSize="13" fontWeight="700" fill="#fff">{p.n}</text>
          </>) : <circle cx={p.x} cy={p.y} r="5" fill="#9fdcff" />}
        </g>
      ))}
      <circle className="bw-halo" cx={CORE.x} cy={CORE.y} r="22" fill="none" stroke="#00a8f0" strokeWidth="2" opacity="0" />
      <g className="bw-core">
        <circle cx={CORE.x} cy={CORE.y} r="34" fill="#0a3fbf" />
        <circle cx={CORE.x} cy={CORE.y} r="23" fill="#00a8f0" />
        <circle cx={CORE.x} cy={CORE.y} r="10" fill="#fff" />
      </g>
    </svg>
  );
}

/**
 * Bienvenida de la primera entrada a un cerebro nuevo. Se reutiliza para volver a verla.
 * `newborn`: el cerebro está casi vacío; solo entonces se dice que acaba de nacer.
 */
export default function BrainWelcome({ onClose, newborn = false }: { onClose: () => void; newborn?: boolean }) {
  const { L } = useUiLang();
  const panel = useRef<HTMLDivElement>(null);
  const close = useRef(onClose); close.current = onClose;

  useEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); close.current(); return; }
      if (e.key !== 'Tab' || !panel.current) return;
      // El foco se queda dentro de la bienvenida mientras está abierta.
      const items = Array.from(panel.current.querySelectorAll<HTMLElement>('a[href], button:not([disabled])'));
      if (items.length === 0) return;
      const first = items[0], last = items[items.length - 1], active = document.activeElement;
      if (e.shiftKey && (active === first || active === panel.current)) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && active === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prevOverflow; try { before?.focus(); } catch {} };
  }, []);

  const steps: { title: string; text: string; href?: string; link?: string }[] = [
    { title: L('Conecta tu agente', 'Connect your agent'), text: L('Son 3 pasos y 2 minutos: creas tu llave, la pegas en tu agente y pruebas. Tu agente pide y consulta; no escribe directo.', 'It takes 3 steps and 2 minutes: create your key, paste it in your agent and test it. Your agent asks and looks things up; it does not write directly.'), href: '/mi-agente', link: L('Conectar mi agente', 'Connect my agent') },
    { title: L('Preséntate', 'Introduce yourself'), text: L('Dile quién eres, tu cargo y con quién trabajas. Así crea tu primera ficha.', 'Tell it who you are, your role and who you work with. That creates your first card.'), href: '/pedir', link: L('Ir a Pedir', 'Go to Ask') },
    { title: L('Pídele en tus palabras', 'Ask in your own words'), text: L('Cada pedido es un caso: se abre y se cierra con un resumen de lo que guardó. Si le falta algo, te pregunta una sola vez. Puedes decir «no lo tengo».', 'Each request is a case: it opens, and it closes with a summary of what was saved. If something is missing, it asks you once. You can say "I don\'t have it".') },
    { title: L('Usa nombres completos', 'Use full names'), text: L('Y dile de dónde viene la información: un correo, una reunión. Así no adivina.', 'And say where the information comes from: an email, a meeting. That way it does not guess.') },
    { title: L('Míralo crecer', 'Watch it grow'), text: L('Mira tus fichas y cómo se conectan.', 'See your cards and how they connect.'), href: '/cerebro', link: L('Ir a Cerebro', 'Go to Brain') },
  ];

  if (typeof document === 'undefined') return null;
  return createPortal(
    <div className="bw-overlay" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div ref={panel} className="bw-panel" role="dialog" aria-modal="true" aria-labelledby="bw-title" aria-describedby="bw-lead" tabIndex={-1}>
        <button type="button" className="bw-close" onClick={onClose} aria-label={L('Cerrar la bienvenida', 'Close the welcome')}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
        <div className="bw-birth">
          <BirthArt />
          <h2 id="bw-title" className="bw-title">{L('Nace un cerebro nuevo', 'A new brain is born')}</h2>
          <p id="bw-lead" className="bw-lead">{L('Es tuyo. Nadie más lo ve. Crece con lo que le cuentas.', 'It is yours. No one else sees it. It grows with what you tell it.')}</p>
          {newborn && <p className="bw-newborn">{L('Tu cerebro acaba de nacer', 'Your brain was just born')}</p>}
        </div>
        <div className="bw-guide">
          <h3>{L('Cinco pasos para que empiece a conectarse', 'Five steps to get it connecting')}</h3>
          <ol className="bw-steps">
            {steps.map((s, i) => (
              <li key={i} className="bw-step" style={{ '--i': i } as React.CSSProperties}>
                <span className="bw-num" aria-hidden="true">{i + 1}</span>
                <div>
                  <h4>{s.title}</h4>
                  <p>{s.text}{s.href && <> <Link href={s.href} onClick={onClose}>{s.link}</Link></>}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="bw-actions">
            <Link href="/mi-agente" className="bw-go" onClick={onClose}>{L('Conectar mi agente', 'Connect my agent')}</Link>
            <button type="button" className="bw-later" onClick={onClose}>{L('Ahora no', 'Not now')}</button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
