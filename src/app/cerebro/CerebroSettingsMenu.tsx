'use client';

import { TYPE_CONFIG } from './layoutTargets';

// Extraído de page.tsx sin cambios de comportamiento.
export function CerebroSettingsMenu({ catalogScope, fetchGraph, graphData, gravityActive, handleCenterAndFit, handleConsolidate, handleSetCatalogScope, handleSetOrgScope, handleSetViewMode, handleUnpinAll, isHudOpen, isSettingsMenuOpen, isSubmitting, nodesRef, orgScope, pinnedCount, pushToStackedDeck, setGravityActive, setIsHudOpen, setIsSettingsMenuOpen, viewMode }: Record<string, any>) {
  return (
    <>
      {isSettingsMenuOpen && (
        <>
          <div
            onClick={() => setIsSettingsMenuOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-xs z-40 animate-in fade-in duration-150"
          />
          <div className="fixed sm:absolute inset-x-0 sm:inset-x-auto sm:right-4 top-12 z-50 w-full sm:w-96 max-h-[calc(100vh-60px)] overflow-y-auto bg-gray-950/98 border border-sky-500/70 sm:rounded-2xl shadow-2xl p-4 space-y-4 backdrop-blur-xl animate-in slide-in-from-top-2 duration-150 text-xs">
            <div className="flex items-center justify-between pb-2 border-b border-gray-800">
              <span className="font-bold text-white flex items-center gap-2 text-sm">
                Ajustes & Control Cerebro
              </span>
              <button
                onClick={() => setIsSettingsMenuOpen(false)}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 transition"
              >
                ✕
              </button>
            </div>

            {/* Quick Node Selector */}
            <div>
              <label className="text-[10px] uppercase font-mono text-gray-400 block mb-1">Ir a Ficha / Entidad:</label>
              <select
                defaultValue=""
                onChange={e => {
                  if (!e.target.value) return;
                  const pool = (graphData as any)?.allNodes || graphData?.nodes || nodesRef.current || [];
                  const targetNode = pool.find((n: any) => n.id === e.target.value);
                  if (targetNode) {
                    pushToStackedDeck(targetNode);
                    handleCenterAndFit(targetNode);
                    setIsSettingsMenuOpen(false);
                  }
                  e.target.value = '';
                }}
                className="w-full bg-gray-900 text-sky-300 border border-gray-700 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:border-sky-400 font-medium"
              >
                <option value="">Seleccionar Entidad por Nombre...</option>
                {(() => {
                  const fullCatalog = (graphData as any)?.allNodes || graphData?.nodes || nodesRef.current || [];
                  return (
                    <>
                      <optgroup label="Marcas Master SMJ">
                        {fullCatalog.filter((n: any) => n.type === 'brand').map((n: any) => (
                          <option key={n.id} value={n.id}>{n.title}</option>
                        ))}
                      </optgroup>
                      <optgroup label="Filiales & Organizaciones Globales">
                        {fullCatalog.filter((n: any) => n.type === 'organization').map((n: any) => (
                          <option key={n.id} value={n.id}>{n.title}</option>
                        ))}
                      </optgroup>
                      <optgroup label="Mercados, Canales, Operadores & Clientes">
                        {fullCatalog.filter((n: any) => n.type === 'market' || n.type === 'distributor' || n.type === 'operator' || n.type === 'channel' || n.type === 'customer' || n.type === 'client_group' || n.type === 'client').map((n: any) => (
                          <option key={n.id} value={n.id}>{(TYPE_CONFIG[n.type] || TYPE_CONFIG.department).icon} {n.title}</option>
                        ))}
                      </optgroup>
                      <optgroup label="Departamentos & Jefaturas">
                        {fullCatalog.filter((n: any) => n.type === 'core' || n.type === 'department').map((n: any) => (
                          <option key={n.id} value={n.id}>{n.title}</option>
                        ))}
                      </optgroup>
                      <optgroup label="Personas & Directivos">
                        {fullCatalog.filter((n: any) => n.type === 'person').map((n: any) => (
                          <option key={n.id} value={n.id}>{n.title}</option>
                        ))}
                      </optgroup>
                    </>
                  );
                })()}
              </select>
            </div>

            {/* View Mode Selector */}
            <div>
              <label className="text-[10px] uppercase font-mono text-gray-400 block mb-1">Modo de Perspectiva:</label>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-1 bg-gray-900 p-1 rounded-lg border border-gray-800">
                <button
                  onClick={() => handleSetViewMode('brujula')}
                  className={`py-1.5 rounded text-xs transition text-center ${
                    viewMode === 'brujula' ? 'bg-sky-600 text-white font-semibold shadow' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  [BR] Brújula
                </button>
                <button
                  onClick={() => handleSetViewMode('version-1-ajustada')}
                  className={`py-1.5 rounded text-xs transition text-center ${
                    viewMode === 'version-1-ajustada' ? 'bg-sky-600 text-white font-semibold shadow' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  [V1] V1 Ajustada
                </button>
                <button
                  onClick={() => handleSetViewMode('constellations')}
                  className={`py-1.5 rounded text-xs transition text-center ${
                    viewMode === 'constellations' ? 'bg-emerald-600 text-white font-semibold shadow' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Constelaciones
                </button>
                <button
                  onClick={() => handleSetViewMode('organigram')}
                  className={`py-1.5 rounded text-xs transition text-center ${
                    viewMode === 'organigram' ? 'bg-purple-600 text-white font-semibold shadow' : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Organigrama
                </button>
              </div>
            </div>

            {/* Catálogo de Marcas & SKUs */}
            <div className="space-y-1.5 pt-1 border-t border-gray-800">
              <label className="text-[10px] uppercase font-mono text-gray-400 flex items-center justify-between">
                <span>Catálogo de SKUs & Multipacks:</span>
                <span className="text-amber-400 font-mono text-[9px]">
                  {catalogScope === 'collapsed' ? 'Plegado (80 Nodos)' : catalogScope === 'all' ? 'Todos (379 Nodos)' : `${catalogScope.toUpperCase()} Activo`}
                </span>
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => handleSetCatalogScope('collapsed')}
                  className={`px-2.5 py-1.5 rounded text-[11px] font-mono border text-left flex items-center justify-between ${
                    catalogScope === 'collapsed' ? 'bg-amber-950/80 border-amber-500 text-amber-200 font-bold' : 'bg-gray-900 border-gray-800 text-gray-300 hover:bg-gray-800'
                  }`}
                >
                  <span>Plegar Todo</span>
                  <span className="text-[9px] text-gray-400">80 N</span>
                </button>
                <button
                  onClick={() => handleSetCatalogScope('all')}
                  className={`px-2.5 py-1.5 rounded text-[11px] font-mono border text-left flex items-center justify-between ${
                    catalogScope === 'all' ? 'bg-amber-950/80 border-amber-500 text-amber-200 font-bold' : 'bg-gray-900 border-gray-800 text-gray-300 hover:bg-gray-800'
                  }`}
                >
                  <span>Desplegar Todo</span>
                  <span className="text-[9px] text-gray-400">379 N</span>
                </button>
              </div>
              <div className="flex items-center gap-1 flex-wrap pt-1">
                {(graphData?.allNodes || graphData?.nodes || []).filter((n: any) => n.type === 'brand').map((n: any) => ({ key: n.id.replace(/^brand-/i, '').toLowerCase(), label: n.frontmatter?.brand_name || n.title.replace(/^Brand:\s*/i, '') })).map((b: any) => (
                  <button
                    key={b.key}
                    onClick={() => handleSetCatalogScope(catalogScope === b.key ? 'collapsed' : (b.key as any))}
                    className={`px-2 py-1 rounded text-[10px] font-mono border transition ${
                      catalogScope === b.key ? 'bg-amber-600 border-amber-400 text-white font-bold' : 'bg-gray-900 border-gray-800 text-gray-400 hover:text-white'
                    }`}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Estructura & Personal */}
            <div className="space-y-1.5 pt-1 border-t border-gray-800">
              <label className="text-[10px] uppercase font-mono text-gray-400 flex items-center justify-between">
                <span>Estructura y Personal:</span>
                <span className="text-purple-400 font-mono text-[9px]">
                  {orgScope === 'collapsed' ? 'Plegado (12 Nodos)' : orgScope === 'all' ? 'Todos (54 Personas)' : `${orgScope} Activo`}
                </span>
              </label>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => handleSetOrgScope('collapsed')}
                  className={`px-2.5 py-1.5 rounded text-[11px] font-mono border text-left flex items-center justify-between ${
                    orgScope === 'collapsed' ? 'bg-purple-950/80 border-purple-500 text-purple-200 font-bold' : 'bg-gray-900 border-gray-800 text-gray-300 hover:bg-gray-800'
                  }`}
                >
                  <span>Plegar Todo</span>
                  <span className="text-[9px] text-gray-400">12 L</span>
                </button>
                <button
                  onClick={() => handleSetOrgScope('all')}
                  className={`px-2.5 py-1.5 rounded text-[11px] font-mono border text-left flex items-center justify-between ${
                    orgScope === 'all' ? 'bg-purple-950/80 border-purple-500 text-purple-200 font-bold' : 'bg-gray-900 border-gray-800 text-gray-300 hover:bg-gray-800'
                  }`}
                >
                  <span>Desplegar Todo</span>
                  <span className="text-[9px] text-gray-400">54 P</span>
                </button>
              </div>
            </div>

            {/* Control de Física, Gravedad y Pines */}
            <div className="space-y-2 pt-1 border-t border-gray-800">
              <label className="text-[10px] uppercase font-mono text-gray-400 block">Física & Control de Nodos:</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setGravityActive(!gravityActive)}
                  className={`px-2.5 py-2 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                    gravityActive ? 'bg-sky-950/80 border-sky-600 text-sky-300' : 'bg-gray-900 border-gray-800 text-gray-400'
                  }`}
                >
                  <span>{gravityActive ? 'Gravedad: Activa' : 'Gravedad: Pausada'}</span>
                </button>

                <button
                  onClick={handleConsolidate}
                  disabled={isSubmitting}
                  className="px-2.5 py-2 rounded-lg border border-amber-600/70 bg-gradient-to-r from-amber-900/60 to-amber-800/60 hover:from-amber-800 hover:to-amber-700 text-amber-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition disabled:opacity-50"
                >
                  <span>Consolidar Nodos</span>
                </button>
              </div>

              {pinnedCount > 0 && (
                <button
                  onClick={() => {
                    handleUnpinAll();
                  }}
                  className="w-full py-2 px-3 rounded-lg bg-cyan-950/80 border border-cyan-500/70 text-cyan-200 text-xs font-mono font-bold flex items-center justify-center gap-1.5 hover:bg-cyan-900/80 transition"
                >
                  <span>Restaurar {pinnedCount} Nodos Anclados (Desanclar Todo)</span>
                </button>
              )}
            </div>

            {/* HUD & Visual Tools */}
            <div className="space-y-2 pt-1 border-t border-gray-800">
              <label className="text-[10px] uppercase font-mono text-gray-400 block">Visualización & Herramientas:</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setIsHudOpen(!isHudOpen)}
                  className={`py-1.5 px-2.5 rounded-lg border text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                    isHudOpen ? 'bg-indigo-950/80 border-indigo-500 text-indigo-300' : 'bg-gray-900 border-gray-800 text-gray-400'
                  }`}
                >
                  <span>{isHudOpen ? 'Ocultar HUD' : 'Mostrar HUD'}</span>
                </button>

                <button
                  onClick={fetchGraph}
                  className="py-1.5 px-2.5 rounded-lg border border-gray-700 bg-gray-900 hover:bg-gray-800 text-gray-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                >
                  <span>Sincronizar Vault</span>
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
}
