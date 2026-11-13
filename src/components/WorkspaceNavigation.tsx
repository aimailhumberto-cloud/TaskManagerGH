'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

export default function WorkspaceNavigation({
  mobile = false,
  publicOnly = false,
  local = false,
  canManage = false,
}: {
  mobile?: boolean;
  publicOnly?: boolean;
  /** Sesión de una cuenta propia: usa el menú nuevo. */
  local?: boolean;
  /** Owner, Admin o Gerente: ve «Usuarios». */
  canManage?: boolean;
}) {
  const pathname = usePathname();

  const H = 'M3 10l9-7 9 7v10H3z', B = 'M12 2a9 9 0 019 9c0 3.87-2.69 7.1-6.4 8.48l-.6.22V22h-4v-2.3l-.6-.22A9.002 9.002 0 013 11a9 9 0 019-9z';
  const A = 'M5 5h14v16H5zM8 3v4m8-4v4M5 10h14', T = 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4';
  const U = 'M16 11a4 4 0 10-8 0 4 4 0 008 0zM4 21a8 8 0 0116 0';
  // Cuentas propias (todas, incluida la del dueño): Inicio, Cerebro, Agenda, Tareas y, para gerencia, Usuarios.
  const modern: string[][] = [['/inicio', 'Inicio', H], ['/cerebro', 'Cerebro', B], ['/mi-agenda', 'Agenda', A], ['/tasks', 'Tareas', T], ...(canManage ? [['/usuarios', 'Usuarios', U]] : [])];
  // Sin sesión propia (modo anterior): el menú histórico.
  const legacy: string[][] = [
    ['/', 'Inicio', H], ['/tasks', 'Tareas', T], ['/cerebro', 'Cerebro SMJ', B],
    ['/empresas', 'Empresas', 'M4 21V3h16v18M8 7h1m6 0h1M8 11h1m6 0h1M10 21v-6h4v6'], ['/agenda', 'Agenda', A],
    ['/supervision', 'Supervisión', 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z'],
    ['/buscar', 'Buscar', 'M21 21l-6-6M17 10a7 7 0 11-14 0 7 7 0 0114 0'], ['/whatsapp', 'WhatsApp', 'M4 4h16v13H9l-5 4z'],
  ].filter(([href]) => !publicOnly || href !== '/whatsapp');
  const navItems = local ? modern : legacy;

  return (
    <nav
      aria-label={mobile ? 'Navegación móvil' : 'Navegación principal'}
      className={
        mobile
          ? 'lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-primary-900/95 backdrop-blur border-t border-primary-800 flex justify-around items-center h-16 px-1'
          : 'flex-1 space-y-1.5 px-4 py-6'
      }
    >
      {navItems.map(([href, label, icon]) => {
        const isActive = pathname === href || (href !== '/' && pathname.startsWith(href));

        return (
          <Link
            key={href}
            href={href}
            aria-current={isActive ? 'page' : undefined}
            className={
              mobile
                ? `flex flex-col items-center justify-center gap-1 py-1 px-1.5 text-[10px] rounded transition-colors ${
                    isActive ? 'text-amber-400 font-bold' : 'text-primary-300 hover:text-white'
                  }`
                : `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                    isActive
                      ? 'bg-primary-800 text-amber-300 font-semibold border-l-2 border-amber-400 shadow-sm'
                      : 'text-primary-200 hover:bg-primary-800/60 hover:text-white'
                  }`
            }
          >
            <svg
              aria-hidden="true"
              className={mobile ? 'h-5 w-5' : 'h-5 w-5 shrink-0'}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={isActive ? '2.2' : '1.7'}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d={icon} />
            </svg>
            <span className={mobile ? 'truncate max-w-[52px] text-center' : ''}>{label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
