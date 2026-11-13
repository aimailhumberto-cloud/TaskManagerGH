'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUiLang } from '@/lib/uiLang';

const BRANDS = [['Busta', '/brands/busta-tile.jpg'], ['Chubby', '/brands/chubby-tile.jpg'], ['Fruta', '/brands/fruta-tile.jpg'], ['Oasis', '/brands/oasis-tile.jpg'], ['Altitude', '/brands/altitude-tile.jpg']];

export default function WorkspaceNavigation({
  mobile = false,
  publicOnly = false,
  local = false,
  canManage = false,
  userName = '',
}: {
  mobile?: boolean;
  publicOnly?: boolean;
  /** Sesión de una cuenta propia: usa el menú nuevo. */
  local?: boolean;
  /** Owner, Admin o Gerente: ve «Usuarios». */
  canManage?: boolean;
  /** Nombre de la persona, para el saludo. */
  userName?: string;
}) {
  const pathname = usePathname();
  const { L } = useUiLang();
  const [nav, setNav] = useState<{ tasks: number; meetings: number; notes: number } | null>(null);
  const [hour, setHour] = useState<number | null>(null);
  const [brandIdx, setBrandIdx] = useState(0);

  // Cifras del día para el saludo y los contadores (solo cuentas propias, solo en la barra lateral).
  useEffect(() => {
    if (!local || mobile) return;
    let alive = true;
    fetch('/api/agent/dashboard').then(r => (r.ok ? r.json() : null)).then(d => { if (alive && d?.nav) setNav(d.nav); }).catch(() => {});
    return () => { alive = false; };
  }, [local, mobile, pathname]);

  // Hora local para el saludo y marca del día (cambia cada día y rota cada 12 segundos).
  useEffect(() => {
    if (mobile) return;
    const now = new Date(); setHour(now.getHours());
    setBrandIdx(Math.floor(now.getTime() / 86400000) % BRANDS.length);
    const id = setInterval(() => setBrandIdx(i => (i + 1) % BRANDS.length), 12000);
    return () => clearInterval(id);
  }, [mobile]);

  const H = 'M3 10l9-7 9 7v10H3z', B = 'M12 2a9 9 0 019 9c0 3.87-2.69 7.1-6.4 8.48l-.6.22V22h-4v-2.3l-.6-.22A9.002 9.002 0 013 11a9 9 0 019-9z';
  const A = 'M5 5h14v16H5zM8 3v4m8-4v4M5 10h14', T = 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4';
  const U = 'M16 11a4 4 0 10-8 0 4 4 0 008 0zM4 21a8 8 0 0116 0';
  // Cuentas propias (todas, incluida la del dueño): Inicio, Cerebro, Agenda, Tareas y, para gerencia, Usuarios.
  const modern: string[][] = [['/inicio', L('Inicio', 'Home'), H], ['/cerebro', L('Cerebro', 'Brain'), B], ['/mi-agenda', L('Agenda', 'Agenda'), A], ['/tasks', L('Tareas', 'Tasks'), T], ...(canManage ? [['/usuarios', L('Usuarios', 'Users'), U]] : [])];
  // Sin sesión propia (modo anterior): el menú histórico.
  const legacy: string[][] = [
    ['/', 'Inicio', H], ['/tasks', 'Tareas', T], ['/cerebro', 'Cerebro SMJ', B],
    ['/empresas', 'Empresas', 'M4 21V3h16v18M8 7h1m6 0h1M8 11h1m6 0h1M10 21v-6h4v6'], ['/agenda', 'Agenda', A],
    ['/supervision', 'Supervisión', 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z'],
    ['/buscar', 'Buscar', 'M21 21l-6-6M17 10a7 7 0 11-14 0 7 7 0 0114 0'], ['/whatsapp', 'WhatsApp', 'M4 4h16v13H9l-5 4z'],
  ].filter(([href]) => !publicOnly || href !== '/whatsapp');
  const navItems = local ? modern : legacy;

  // Contador de cada entrada: en azul claro lo que pide atención hoy; discreto el total de notas.
  const badge = (href: string): { n: number; hot: boolean } | null => {
    if (!nav) return null;
    if (href === '/tasks' && nav.tasks > 0) return { n: nav.tasks, hot: true };
    if (href === '/mi-agenda' && nav.meetings > 0) return { n: nav.meetings, hot: true };
    if (href === '/cerebro' && nav.notes > 0) return { n: nav.notes, hot: false };
    return null;
  };

  const first = (userName || '').trim().split(/\s+/)[0] || '';
  const greeting = hour === null ? '' : hour < 12 ? L('Buenos días', 'Good morning') : hour < 19 ? L('Buenas tardes', 'Good afternoon') : L('Buenas noches', 'Good evening');
  const dayLine = nav
    ? [
        nav.tasks === 0 ? L('Sin tareas hoy', 'No tasks today') : `${nav.tasks} ${nav.tasks === 1 ? L('tarea hoy', 'task today') : L('tareas hoy', 'tasks today')}`,
        nav.meetings === 0 ? null : `${nav.meetings} ${nav.meetings === 1 ? L('reunión', 'meeting') : L('reuniones', 'meetings')}`,
      ].filter(Boolean).join(' · ')
    : '';
  const brand = BRANDS[brandIdx];

  const links = navItems.map(([href, label, icon]) => {
    const isActive = pathname === href || (href !== '/' && pathname.startsWith(href));
    const b = mobile ? null : badge(href);
    return (
      <Link
        key={href}
        href={href}
        aria-current={isActive ? 'page' : undefined}
        className={
          mobile
            ? `flex flex-col items-center justify-center gap-1 py-1 px-1.5 text-[10px] rounded transition-colors ${
                isActive ? 'text-white font-bold' : 'text-[#9fdcff] hover:text-white'
              }`
            : `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors ${
                isActive ? 'bg-white text-[#0a3fbf] font-semibold shadow-sm' : 'text-[#dbeafe] hover:bg-white/10 hover:text-white'
              }`
        }
      >
        <svg aria-hidden="true" className={mobile ? 'h-5 w-5' : 'h-5 w-5 shrink-0'} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={isActive ? '2.2' : '1.7'}>
          <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
        </svg>
        <span className={mobile ? 'truncate max-w-[52px] text-center' : ''}>{label}</span>
        {b && (
          <span className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-semibold ${b.hot ? 'bg-[#00a8f0] text-[#0b1f4d]' : isActive ? 'text-[#0a3fbf]/70' : 'text-[#9fdcff]'}`}>{b.n}</span>
        )}
      </Link>
    );
  });

  if (mobile) {
    return (
      <nav aria-label={L('Navegación móvil', 'Mobile navigation')} className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#0b1f4d]/95 backdrop-blur border-t border-white/10 flex justify-around items-center h-16 px-1">
        {links}
      </nav>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-4 py-4">
      {local && greeting && (
        <div className="mb-4 rounded-2xl bg-[#0a3fbf] px-4 py-3">
          <p className="text-xs text-[#9fdcff]">{greeting}{first ? `, ${first}` : ''}</p>
          <p className="mt-0.5 min-h-[20px] text-[13px] font-medium text-white">{dayLine}</p>
        </div>
      )}
      <nav aria-label={L('Navegación principal', 'Main navigation')} className="space-y-1.5">
        {links}
      </nav>
      <div className="mt-auto pt-5">
        <div className="overflow-hidden rounded-2xl bg-[#0a3fbf]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img key={brand[1]} src={brand[1]} alt={brand[0]} className="h-24 w-full object-cover" />
          <div className="px-3 py-2.5">
            <p className="text-[13px] font-semibold text-white">{brand[0]}</p>
            <p className="text-[11px] text-[#9fdcff]">{L('Marcas que amas', 'Brands you love')}</p>
          </div>
        </div>
        <div className="mt-2.5 flex justify-center gap-1.5" aria-hidden="true">
          {BRANDS.map((x, i) => (<span key={x[0]} className={`h-1.5 rounded-full transition-all ${i === brandIdx ? 'w-5 bg-[#00a8f0]' : 'w-1.5 bg-white/25'}`} />))}
        </div>
      </div>
    </div>
  );
}
