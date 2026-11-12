'use client';

import type { HeaderProps } from './props';

import Link from 'next/link';
import { humanNodeName } from '@/lib/smjIdentity';
import { TYPE_CONFIG } from './layoutTargets';

// Extraído de page.tsx sin cambios de comportamiento.
export function CerebroHeader({ graphData, handleCenterAndFit, handleSetViewMode, isSettingsMenuOpen, lastSyncTime, nodesRef, pushToStackedDeck, searchQuery, searchResults, setIsSettingsMenuOpen, setSearchQuery, setStackedDeck, stackedDeck, summary, viewMode }: HeaderProps) {
  return (
    <>
      <header className="h-12 max-h-[48px] px-3 md:px-5 flex items-center justify-between border-b border-gray-800 bg-[#0B111E] z-50 shrink-0 relative shadow-md">
        {/* Left: Brand & Node Count */}
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          <Link
            href="/tasks"
            className="text-xs uppercase font-bold tracking-wider text-amber-400 hover:text-amber-300 transition flex items-center gap-1.5 shrink-0 bg-amber-500/10 hover:bg-amber-500/20 px-2.5 py-1 rounded border border-amber-500/30"
            title="Ir a TaskManager Ejecutivo (Tareas)"
          >
            <span>←</span>
            <span>Tareas</span>
          </Link>
          <div className="h-4 w-px bg-gray-700 shrink-0" />
          <div className="flex items-center gap-1.5 min-w-0">
            <h1 className="font-bold text-xs md:text-sm tracking-wide text-white truncate flex items-center gap-1.5">
              <span>SMJ Cerebro</span>
              <span className="hidden xl:inline text-sky-400 font-normal">| Segundo Cerebro Vivo</span>
            </h1>
          </div>
          {/* Node Count Pill */}
          <span className="px-1.5 py-0.5 text-[9px] font-mono bg-sky-950 text-sky-300 border border-sky-800 rounded font-semibold shrink-0">
            {graphData?.nodes.length || summary.totalNodes} Nodos
          </span>

          {/* Panama Sync Time Pill (Point 11) */}
          {lastSyncTime && (
            <span className="hidden md:inline-flex px-2 py-0.5 text-[9px] font-mono bg-slate-900/90 text-slate-300 border border-slate-700 rounded items-center gap-1 shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span>{lastSyncTime} (Panamá)</span>
            </span>
          )}
        </div>

        {/* Center: Search Bar with Autocomplete Dropdown */}
        <div className="hidden sm:flex relative flex-1 max-w-xs md:max-w-md mx-3">
          <div className="flex items-center bg-gray-900/90 border border-gray-700 focus-within:border-sky-500 rounded-lg px-2.5 py-1 w-full transition shadow-inner">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar marca, filial, rol, persona..."
              className="bg-transparent text-white text-xs placeholder-gray-500 focus:outline-none w-full font-mono"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="text-gray-400 hover:text-white text-xs px-1"
              >
                ✕
              </button>
            )}
          </div>

          {/* Search Results Dropdown */}
          {searchResults.length > 0 && (
            <div className="absolute top-full left-0 right-0 mt-1.5 max-h-72 overflow-y-auto bg-gray-950/98 border border-sky-500/80 rounded-xl shadow-2xl p-1.5 z-50 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100">
              <div className="text-[10px] font-mono text-gray-400 uppercase px-2 py-1 border-b border-gray-800 mb-1 flex items-center justify-between">
                <span>Resultados</span>
                <span className="text-sky-400 font-bold">{searchResults.length}</span>
              </div>
              {searchResults.slice(0, 8).map((node: any) => (
                <div
                  key={node.id}
                  onClick={() => {
                    pushToStackedDeck(node);
                    handleCenterAndFit(node);
                    setSearchQuery('');
                  }}
                  className="flex items-center justify-between p-2 rounded-lg hover:bg-sky-950/80 cursor-pointer text-xs transition border border-transparent hover:border-sky-800/60"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-base shrink-0">{(TYPE_CONFIG[node.type] || TYPE_CONFIG.department).icon}</span>
                    <div className="min-w-0">
                      <p className="font-bold text-white truncate">{humanNodeName(node)}</p>
                      <p className="text-[10px] text-gray-400 font-mono">{(TYPE_CONFIG[node.type] || TYPE_CONFIG.department).label}</p>
                    </div>
                  </div>
                  <span className="text-[10px] text-sky-400 font-mono shrink-0">Ver →</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Right: Quick Action Controls */}
        <div className="flex items-center gap-1.5 md:gap-2 shrink-0">
          {/* Desktop View Mode Switcher */}
          <div className="hidden lg:flex items-center bg-gray-900 p-0.5 rounded-lg border border-gray-700 text-xs">
            <button
              onClick={() => handleSetViewMode('brujula')}
              className={`px-2 py-1 rounded transition text-[11px] font-medium ${
                viewMode === 'brujula' ? 'bg-sky-600 text-white shadow font-semibold' : 'text-gray-400 hover:text-white'
              }`}
            >
              [BR] Brújula
            </button>
            <button
              onClick={() => handleSetViewMode('version-1-ajustada')}
              className={`px-2 py-1 rounded transition text-[11px] font-medium ${
                viewMode === 'version-1-ajustada' ? 'bg-sky-600 text-white shadow font-semibold' : 'text-gray-400 hover:text-white'
              }`}
            >
              [V1] V1 Ajustada
            </button>
            <button
              onClick={() => handleSetViewMode('constellations')}
              className={`px-2 py-1 rounded transition text-[11px] font-medium ${
                viewMode === 'constellations' ? 'bg-emerald-600 text-white shadow font-semibold' : 'text-gray-400 hover:text-white'
              }`}
            >
              Constelaciones
            </button>
            <button
              onClick={() => handleSetViewMode('organigram')}
              className={`px-2 py-1 rounded transition text-[11px] font-medium ${
                viewMode === 'organigram' ? 'bg-purple-600 text-white shadow font-semibold' : 'text-gray-400 hover:text-white'
              }`}
            >
              Organigrama
            </button>
            <button
              onClick={() => handleSetViewMode('quadrants')}
              className={`px-2 py-1 rounded transition text-[11px] font-medium ${
                viewMode === 'quadrants' ? 'bg-slate-700 text-white shadow font-semibold' : 'text-gray-400 hover:text-white'
              }`}
            >
              Cuadrantes
            </button>
          </div>

          {/* Centrar Button */}
          <button
            onClick={() => handleCenterAndFit()}
            className="px-2.5 py-1 rounded-lg bg-gray-800 hover:bg-gray-700 text-sky-300 border border-sky-800/80 text-xs font-semibold flex items-center gap-1 transition shadow-sm active:scale-95"
            title="Centrar y reencuadrar el mapa"
          >
            <span className="hidden sm:inline">Centrar</span>
          </button>

          {/* Fichas Deck Counter Button */}
          <button
            onClick={() => {
              if (stackedDeck.length === 0) {
                const coreNode = nodesRef.current.find((n: any) => n.type === 'core') || nodesRef.current[0];
                if (coreNode) pushToStackedDeck(coreNode);
              } else {
                setStackedDeck([]);
              }
            }}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border flex items-center gap-1.5 transition active:scale-95 ${
              stackedDeck.length > 0
                ? 'bg-sky-600 text-white border-sky-400 shadow'
                : 'bg-gray-800 text-gray-300 border-gray-700 hover:text-white'
            }`}
            title="Abrir o cerrar fichas ejecutivas"
          >
            <span className="hidden md:inline">Fichas</span>
            <span className="font-mono text-[11px] font-bold">({stackedDeck.length})</span>
          </button>

          {/* Unified Settings Button */}
          <button
            onClick={() => setIsSettingsMenuOpen(!isSettingsMenuOpen)}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border flex items-center gap-1.5 transition shadow-sm active:scale-95 ${
              isSettingsMenuOpen
                ? 'bg-gradient-to-r from-sky-600 to-indigo-600 text-white border-sky-400 shadow'
                : 'bg-gray-800 text-sky-300 border-sky-800/80 hover:bg-gray-700'
            }`}
            title="Herramientas, capas de catálogo y ajustes del cerebro"
          >
            <span className="hidden md:inline">Ajustes</span>
            <span className="text-[10px] font-mono">{isSettingsMenuOpen ? '▲' : '▼'}</span>
          </button>
        </div>
      </header>
    </>
  );
}
