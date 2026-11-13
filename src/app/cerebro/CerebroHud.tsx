'use client';

import { useLang } from './i18n';
import type { HudProps } from './props';


// Extraído de page.tsx sin cambios de comportamiento.
export function CerebroHud({ contactStats, graphData, handleConsolidate, isHudOpen, isSubmitting, linkHealthAudit, summary, workingMemoryStats }: HudProps) {
  const { t } = useLang();
  return (
    <>
      {isHudOpen && (
        <section className="bg-[#090E1A]/95 border-b border-gray-800/80 px-5 py-2.5 z-40 shadow-xl backdrop-blur-md">
          <div className="cerebro-hud-strip flex gap-3 max-w-[1920px] mx-auto overflow-x-auto pb-1">
            
            {/* Widget 1: Salud de Memoria & Enlaces Rotos */}
            <div className={`p-2.5 rounded-xl border backdrop-blur transition-all ${
              linkHealthAudit.brokenCount === 0
                ? 'bg-gray-900/80 border-emerald-500/40 hover:border-emerald-500/70'
                : 'bg-amber-950/40 border-amber-500/60 hover:border-amber-500'
            }`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-mono uppercase tracking-wider text-gray-400 font-bold flex items-center gap-1">
                  {t("Salud Memoria")}
                </span>
                <span className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold ${
                  linkHealthAudit.brokenCount === 0
                    ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                    : 'bg-amber-950 text-amber-300 border border-amber-800 animate-pulse'
                }`}>
                  {linkHealthAudit.brokenCount === 0 ? 'Coherente' : `${linkHealthAudit.brokenCount} Rotos`}
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-bold text-white font-mono">
                  {linkHealthAudit.brokenCount === 0 ? '0 Enlaces Rotos' : `${linkHealthAudit.brokenCount} Enlaces Rotos`}
                </span>
              </div>
              <div className="mt-1 text-[9px] text-gray-400 truncate font-mono">
                {linkHealthAudit.brokenCount === 0 ? 'Sinapsis íntegras en bóveda' : `Faltan: ${linkHealthAudit.brokenSample.join(', ')}`}
              </div>
            </div>

            {/* Widget 2: Memoria Viva & Cierre S&OP */}
            <div className="p-2.5 rounded-xl bg-gray-900/80 border border-amber-500/40 hover:border-amber-500/70 backdrop-blur transition-all">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400 font-bold flex items-center gap-1">
                  {t("Memoria Viva & S&OP")}
                </span>
                <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-amber-950 text-amber-300 border border-amber-800">
                  {workingMemoryStats.activeCount} {t("en tránsito")}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-bold text-white font-mono">
                    {workingMemoryStats.avgCompleteness}%
                  </span>
                  <span className="text-[10px] text-gray-400 font-mono ml-1.5">{t("Avance Operativo")}</span>
                </div>
                <button
                  onClick={handleConsolidate}
                  disabled={isSubmitting}
                  className="text-[9px] px-2 py-0.5 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded shadow transition flex items-center gap-1"
                  title={t("Consolidar recuerdos temporales")}
                >
                  {t("Consolidar")}
                </button>
              </div>
              <div className="mt-1.5 w-full bg-gray-800 h-1.5 rounded-full overflow-hidden">
                <div className="bg-amber-400 h-full rounded-full transition-all duration-500" style={{ width: `${workingMemoryStats.avgCompleteness}%` }} />
              </div>
            </div>

            {/* Widget 3: Directorio Humano & Canales de Contacto */}
            <div className="p-2.5 rounded-xl bg-gray-900/80 border border-sky-500/40 hover:border-sky-500/70 backdrop-blur transition-all">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-mono uppercase tracking-wider text-sky-400 font-bold flex items-center gap-1">
                  {t("Directorio Humano")}
                </span>
                <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-sky-950 text-sky-300 border border-sky-800">
                  {contactStats.leaders + contactStats.operational} {t("Total")}
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-bold text-white font-mono">
                  {contactStats.leaders} <span className="text-[10px] text-gray-400 font-normal">{t("Líderes")}</span> · {contactStats.operational} <span className="text-[10px] text-gray-400 font-normal">{t("Staff")}</span>
                </span>
                <span className="text-[10px] text-emerald-400 font-mono">
                  {contactStats.activeWhatsapps} WA
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between text-[9px] text-gray-400 font-mono">
                <span>{contactStats.verifiedEmails} {t("Emails Verificados")}</span>
                <span className="text-sky-400 font-semibold">{contactStats.leaders + contactStats.operational > 0 ? Math.round((contactStats.verifiedEmails / (contactStats.leaders + contactStats.operational)) * 100) : 0}{t("% con correo")}</span>
              </div>
            </div>

            {/* Widget 4: Telemetría Neuronal & Sincronía en Vivo */}
            <div className="p-2.5 rounded-xl bg-gray-900/80 border border-indigo-500/40 hover:border-indigo-500/70 backdrop-blur transition-all">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-mono uppercase tracking-wider text-indigo-400 font-bold flex items-center gap-1">
                  {t("Red & Sinapsis")}
                </span>
                <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-indigo-950 text-indigo-300 border border-indigo-800 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" /> {t("Live Vault")}
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-bold text-white font-mono">
                  {summary.totalNodes} <span className="text-[10px] text-gray-400 font-normal">{t("Nodos")}</span>
                </span>
                <span className="text-xs font-bold text-sky-400 font-mono">
                  {summary.totalLinks} <span className="text-[9px] text-gray-400 font-normal">{t("Sinapsis")}</span>
                </span>
              </div>
              <div className="mt-1 flex items-center justify-between text-[9px] text-gray-400 font-mono">
                <span>{(() => {
                  const all = graphData?.allNodes || graphData?.nodes || [];
                  const total = all.length || 1;
                  const pct = (types: string[]) => Math.round((all.filter((n: any) => types.includes(n.type)).length / total) * 100);
                  return `Portafolio ${pct(['brand', 'product_line', 'flavor', 'packaging', 'product_variant', 'catalog_listing'])}% · Personal ${pct(['person'])}% · Red ${pct(['market', 'distributor', 'operator', 'channel', 'customer', 'client_group', 'client', 'country'])}%`;
                })()}</span>
              </div>
            </div>

            {/* Widget 5: Capacidad de Portafolio & Cadena de Suministro */}
            <div className="p-2.5 rounded-xl bg-gray-900/80 border border-teal-500/40 hover:border-teal-500/70 backdrop-blur transition-all">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[10px] font-mono uppercase tracking-wider text-teal-400 font-bold flex items-center gap-1">
                  {t("Portafolio & Supply")}
                </span>
                <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-teal-950 text-teal-300 border border-teal-800">
                  {graphData?.summary.brandsCount ?? '—'} {t("Marcas Máster")}
                </span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-bold text-white font-mono">
                  {(graphData?.allNodes || graphData?.nodes || []).filter((n: any) => n.type === 'product_variant').length} <span className="text-[10px] text-gray-400 font-normal">{t("SKUs")}</span> · {(graphData?.allNodes || graphData?.nodes || []).filter((n: any) => n.type === 'packaging').length} <span className="text-[10px] text-gray-400 font-normal">{t("Packs")}</span>
                </span>
                <span className="text-[10px] text-teal-300 font-mono">{(graphData?.allNodes || graphData?.nodes || []).filter((n: any) => n.type === 'flavor').length} {t("Sabores")}</span>
              </div>
            </div>

          </div>
        </section>
      )}
    </>
  );
}
