'use client';

import { useLang } from './i18n';
import React, { useEffect, useRef, useState, useMemo } from 'react';
import Link from 'next/link';
import { getMarketDistributors, marketDistributorLabel, distributorDisplayName } from '@/lib/marketDistributors';
import { searchBrainNodes, resolveBrainNode, humanNodeName, fitIdentityBounds } from '@/lib/smjIdentity';
import { computeNativeLayout, mergeLayoutConfig } from '@/lib/cerebroLayout';
import { contactTarget, contactEntities } from '@/lib/contactLayer';
import { ContactLayer } from '@/components/ContactLayer';
import { brandCatalogNodes, packagingDescription } from '@/lib/portfolioConnections';
import { PortfolioConnections } from '@/components/PortfolioConnections';
import { CommercialConnections } from '@/components/CommercialConnections';
import type { SideCardProps } from './props';
import type { NodeData, LinkData, BrainGraphResponse } from './types';
import { BRAND_AVATARS, getPhotoUrlWithBust, getNodeCustomPhoto, drawPanamaFlag, drawCanadaFlag, drawUSAFlag, drawBelizeFlag, drawTrinidadFlag, drawSMJCorporateCrest, drawPersonAvatar, drawDistributorBadge, drawOrganizationBadge, drawBrandBadge, drawGlassDomeOverlay, drawAmericasMapBackdrop } from './nodeArt';
import { formatDisplayValue, renderFormattedBody } from './bodyFormat';
import { TYPE_CONFIG, nodeLevel, MAX_NODES_PER_OPEN, isNodeLeader, getPersonDeptCategory, CLUSTER_CENTERS, ORGANIGRAM_STRATA, assignQuadrantTarget, assignClusterTarget, assignOrganigramTarget } from './layoutTargets';
import { CerebroHeader } from './CerebroHeader';
import { CerebroSettingsMenu } from './CerebroSettingsMenu';
import { CerebroHud } from './CerebroHud';

// Extraído de page.tsx sin cambios de comportamiento.
export function CerebroSideCard({ catalogScope, expandedBrandInDossier, expandedDeptInDossier, expandedLeaderInDossier, getWikilinkLabel, graphData, handleSetCatalogScope, handleSetOrgScope, handleWikilinkClick, inspectorRef, linksRef, nodeBodies, nodesRef, pushToStackedDeck, removeFromDeck, setExpandedBrandInDossier, setExpandedDeptInDossier, setExpandedLeaderInDossier, setStackedDeck, setStatusMessage, stackedDeck }: SideCardProps) {
  const { t } = useLang();
  return (
    <>
        {/* Stacked Decks: Sliding Bottom Sheet on mobile (<768px) / Lateral Side Panel on desktop (>=768px) */}
        {stackedDeck.length > 0 && (
          <>
            {/* Mobile Backdrop Overlay */}
            <div
              onClick={() => setStackedDeck([])}
              className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-xs transition-opacity duration-300 animate-in fade-in"
              aria-hidden="true"
            />

            <aside className="fixed inset-x-0 bottom-0 z-50 w-full max-h-[85vh] h-[75vh] md:h-full md:relative md:inset-auto md:w-[440px] xl:w-[480px] 2xl:w-[520px] md:max-w-[38vw] shrink-0 border-t md:border-t-0 md:border-l border-gray-700 md:border-gray-800 bg-[#0B111E]/98 backdrop-blur-xl flex flex-col shadow-2xl transition-transform duration-300 ease-out overflow-hidden rounded-t-2xl md:rounded-none animate-in slide-in-from-bottom md:slide-in-from-right">
              {/* Visual Pill Drag Handle (Mobile only) */}
              <div className="md:hidden flex justify-center pt-2.5 pb-1 bg-gray-900/90 shrink-0">
                <div className="w-12 h-1.5 bg-gray-500 rounded-full" />
              </div>

              {/* Aside / Bottom Sheet Header */}
              <div className="flex items-center justify-between px-4 py-2.5 md:py-3 border-b border-gray-800 bg-gray-900/90 sticky top-0 z-10 shadow shrink-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-sky-400 flex items-center gap-1.5">
                    <span>{stackedDeck.length > 1 ? `Fichas (${stackedDeck.length})` : 'Ficha'}</span>
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  {/* Thumb-Accessible Close Button (min 44x44px touch target on mobile) */}
                  <button
                    onClick={() => setStackedDeck([])}
                    className="min-h-[44px] min-w-[44px] md:min-h-[32px] md:min-w-0 text-xs px-3 py-2 md:px-2.5 md:py-1 rounded-lg md:rounded bg-gray-800 hover:bg-red-950/80 text-gray-200 hover:text-red-300 border border-gray-700 hover:border-red-800 transition font-mono flex items-center justify-center gap-1.5 active:scale-95"
                    title={t("Cerrar ficha")}
                    aria-label={t("Cerrar ficha ejecutiva")}
                  >
                    <span className="text-sm">✕</span>
                    <span className="hidden md:inline">{t("Cerrar Todo")}</span>
                    <span className="md:hidden text-xs font-sans">{t("Cerrar")}</span>
                  </button>
                </div>
              </div>

              <div ref={inspectorRef} className="flex-1 overflow-y-auto overflow-x-hidden p-4 space-y-4 overscroll-contain">
              {stackedDeck.map((node: any) => {
                const cfg = TYPE_CONFIG[node.type] || TYPE_CONFIG.department;
                const fm = node.frontmatter || {};

                const nid = node.id.toLowerCase();
                const photoSrc = fm.avatar_image || fm.photo_url || fm.visual_photo_url || fm.visual_logo_url || 
                  (nid.includes('medimex') ? '/brands/medimex-logo.png' :
                   nid.includes('sm-jaleel') || node.type === 'core' ? '/brands/smjaleel-logo.png' :
                   nid.includes('chubby') ? '/brands/chubby.png' :
                   nid.includes('busta') ? '/brands/busta.png' :
                   nid.includes('fruta') ? '/brands/fruta.png' :
                   nid.includes('oasis') ? '/brands/oasis.png' :
                   nid.includes('altitude') ? '/brands/altitude.png' : null);
                const logoSrc = photoSrc;

                const flagEmoji = (node.type === 'market' && (fm.iso_code === 'TT' || nid.includes('trinidad'))) ? '🇹🇹' :
                  (node.type === 'market' && (fm.iso_code === 'PA' || nid.includes('panama'))) ? '🇵🇦' :
                  (node.type === 'market' && (fm.iso_code === 'CA' || nid.includes('canada'))) ? '🇨🇦' :
                  (node.type === 'market' && (fm.iso_code === 'US' || nid.includes('united-states'))) ? '🇺🇸' :
                  (node.type === 'market' && (fm.iso_code === 'BZ' || nid.includes('belize'))) ? '🇧🇿' : null;

                const galleryPhotos: string[] = (() => {
                  if (Array.isArray(fm.gallery_photos) && fm.gallery_photos.length > 0) {
                    return fm.gallery_photos;
                  }
                  const collected: string[] = [];
                  if (fm.visual_logo_url) collected.push(fm.visual_logo_url);
                  if (fm.visual_photo_url) collected.push(fm.visual_photo_url);
                  if (nid.includes('medimex')) {
                    collected.push('/brands/medimex-logo.png', '/brands/chubby-bottles.png', '/brands/fruta-bottles.png');
                  } else if (nid.includes('chubby')) {
                    collected.push('/brands/chubby-logo.png', '/brands/chubby-bottles.png', '/brands/chubby_tile.png');
                  } else if (nid.includes('busta')) {
                    collected.push('/brands/busta-logo.png', '/brands/busta-bottles.png', '/brands/busta_tile.png');
                  } else if (nid.includes('fruta')) {
                    collected.push('/brands/fruta-logo.png', '/brands/fruta-bottles.png', '/brands/fruta_tile.png');
                  } else if (nid.includes('oasis')) {
                    collected.push('/brands/oasis.png', '/brands/oasis-water.png');
                  } else if (nid.includes('altitude')) {
                    collected.push('/brands/altitude-logo.png', '/brands/altitude-can.png', '/brands/altitude_tile.png');
                  } else if (nid.includes('sm-jaleel') || node.type === 'core') {
                    collected.push('/brands/smjaleel-logo.png', '/brands/manufacturing-banner.jpg', '/brands/manufacturing-line-1.jpg');
                  } else if (nid.includes('trinidad')) {
                    collected.push('/brands/smjaleel-logo.png', '/brands/manufacturing-banner.jpg');
                  }
                  return Array.from(new Set(collected)).slice(0, 3);
                })();

                const contactWa = fm.whatsapp || fm.phone_mobile || fm.direct_contacts?.whatsapp || null;
                const contactEmail = fm.email_orders || fm.email_primary || fm.direct_contacts?.email || (nid.includes('medimex') ? 'pedidos@medimexsa.com' : null);
                const contactPhone = fm.phone_main || fm.direct_contacts?.phone || (nid.includes('medimex') ? '+507 270-2000' : null);

                return (
                  <div
                    key={node.id}
                    className="border rounded-xl p-4 bg-gray-900/90 shadow-xl relative transition-all"
                    style={{ borderColor: cfg.border }}
                  >
                    {/* Header Card with Big Identity Visual */}
                    <div className="flex items-start justify-between gap-3 border-b border-gray-800 pb-3 mb-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div
                          className="w-12 h-12 rounded-full flex items-center justify-center text-xl shadow-lg border-2 shrink-0 overflow-hidden bg-gray-950 p-1 relative"
                          style={{ borderColor: cfg.border }}
                        >
                          {photoSrc && (
                            <img
                              src={getPhotoUrlWithBust(photoSrc, fm.updated_at || fm.updatedAt) || photoSrc}
                              alt={node.title}
                              className="w-full h-full object-cover rounded-full z-10"
                              onError={(e) => {
                                (e.currentTarget as HTMLElement).style.display = 'none';
                              }}
                            />
                          )}
                          <span className="absolute inset-0 flex items-center justify-center text-base">
                            {flagEmoji || cfg.icon}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className="px-2 py-0.5 rounded text-[10px] font-mono uppercase font-bold text-white shrink-0"
                              style={{ backgroundColor: cfg.bg }}
                            >
                              {cfg.label}
                            </span>
                            {node.completeness_score !== undefined && (
                              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-800 shrink-0">
                                {node.completeness_score}{t("% completitud")}
                              </span>
                            )}
                            {fm.is_active !== undefined && (
                              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border shrink-0 ${fm.is_active ? 'text-sky-300 bg-sky-950/60 border-sky-800' : 'text-gray-400 bg-gray-800/60 border-gray-700'}`}>
                                {fm.is_active ? 'OFICIAL / ACTIVO' : 'HISTÓRICO'}
                              </span>
                            )}
                          </div>
                          <h2 tabIndex={-1} className="cerebro-card-title mt-1.5 text-xl leading-snug text-white" title={node.id}>{humanNodeName(node).replace(/^[A-Za-z][A-Za-z &]{2,22}(?::\s+|\s+-\s+)/, '')}</h2>
                          {fm.job_title && (
                            <p className="text-xs text-sky-400 font-mono truncate">{fm.job_title}</p>
                          )}
                          {fm.legal_name && fm.legal_name !== node.title && (
                            <p className="text-[11px] text-gray-400 font-mono truncate">{fm.legal_name}</p>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => removeFromDeck(node.id)}
                        className="text-gray-400 hover:text-white p-1 text-sm leading-none shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-gray-800 transition active:scale-95"
                        title={t("Cerrar ficha")}
                        aria-label={`Cerrar ficha de ${node.title}`}
                      >
                        ✕
                      </button>
                    </div>

                    {/* Topología y Ruta Comercial (4 Capas) */}
                    {(fm.market || fm.channel_type || fm.parent_distributor_id || fm.supplied_by || fm.serves_clients || fm.clients || fm.country) && (
                      <div className="mb-3 bg-gradient-to-r from-emerald-950/40 via-slate-900 to-sky-950/40 border border-emerald-500/30 rounded-xl p-3 shadow-lg">
                        <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-bold mb-2">
                          <span className="flex items-center gap-1.5">
                            <span>{t("Ruta Comercial & Topología (4 Capas)")}</span>
                          </span>
                          <span className="text-gray-400 text-[9px] font-mono">
                            {node.spatial_tier ? `Capa: ${String(node.spatial_tier).toUpperCase()}` : 'Topología Viva'}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono">
                          {/* 1. Mercado */}
                          <span className="px-2 py-0.5 rounded bg-emerald-950 border border-emerald-700/80 text-emerald-300 font-semibold text-[10px]">
                            {fm.country_name || fm.based_in_country || fm.country || 'Mercado Internacional'}
                          </span>
                          <span className="text-gray-500">→</span>
                          {/* 2. Canal */}
                          <span className="px-2 py-0.5 rounded bg-teal-950 border border-teal-700/80 text-teal-300 font-semibold text-[10px]">
                            {fm.channel_label || fm.channel_type || (node.type === 'channel' ? node.title : 'Canal Directo')}
                          </span>
                          {/* 3. Operador / Suministrador */}
                          {(fm.parent_distributor_id || fm.supplied_by || node.type === 'distributor' || node.type === 'operator') && (
                            <>
                              <span className="text-gray-500">→</span>
                              <span className="px-2 py-0.5 rounded bg-sky-950 border border-sky-700/80 text-sky-300 font-semibold text-[10px]">
                                {fm.company_name || fm.supplied_by || (node.type === 'distributor' ? node.title : 'Operador Asignado')}
                              </span>
                            </>
                          )}
                        </div>

                        {/* Clientes o Marcas asociadas */}
                        {(fm.serves_clients || fm.clients || fm.active_brands || fm.carries_brands) && (
                          <div className="mt-2 pt-2 border-t border-gray-800/80 text-[10px] text-gray-400 flex flex-col gap-1">
                            {fm.serves_clients && (
                              <div>
                                <span className="text-slate-400 font-bold">{t("Cuentas Clave:")} </span>
                                <span className="text-slate-200">{Array.isArray(fm.serves_clients) ? fm.serves_clients.join(', ').replace(/\[\[|\]\]/g, '') : fm.serves_clients}</span>
                              </div>
                            )}
                            {(fm.active_brands || fm.carries_brands) && (
                              <div>
                                <span className="text-amber-400 font-bold">{t("Marcas Activas:")} </span>
                                <span className="text-slate-200">{Array.isArray(fm.active_brands || fm.carries_brands) ? (fm.active_brands || fm.carries_brands).join(', ').replace(/\[\[|\]\]/g, '') : ''}</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    {/* 1. Telemetría Ejecutiva en Vivo (Metadatos de Alto Valor) */}
                    <div className="mb-3 bg-gradient-to-r from-sky-950/80 via-gray-950 to-indigo-950/80 border border-sky-500/40 rounded-xl p-3 shadow-inner">
                      <div className="flex items-center justify-between text-[10px] font-mono uppercase text-sky-400 font-bold mb-2">
                        <span className="flex items-center gap-1.5">
                          <span>{t("Actividad registrada")}</span>
                        </span>
                        <span className="text-gray-400 text-[9px]">{t("Datos de la ficha")}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                        <div className="bg-gray-900/80 p-2 rounded border border-gray-800">
                          <span className="text-[10px] text-gray-400 block">{t("Última Actualización:")}</span>
                          <span className="text-white font-semibold text-[11px]">
                            {(fm.last_updated_at || fm.updated_at) ? new Date(fm.last_updated_at || fm.updated_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Sin fecha registrada'}
                          </span>
                          <span className="text-[9px] text-sky-400 block truncate">Por: {fm.last_updated_by || 'No documentado'}</span>
                        </div>
                        <div className="bg-gray-900/80 p-2 rounded border border-gray-800">
                          <span className="text-[10px] text-gray-400 block">{t("Último correo registrado:")}</span>
                          <span className="text-white font-semibold text-[11px] truncate block" title={fm.last_email_subject || 'No consta en esta ficha'}>
                            {fm.last_email_subject || 'No consta en esta ficha'}
                          </span>
                          <span className="text-[9px] text-emerald-400 block truncate">
                            {fm.last_email_date ? `${fm.last_email_date} · ` : ''}{fm.last_email_sender || 'Remitente no documentado'}
                          </span>
                        </div>
                        {(fm.next_followup_action || fm.next_followup_date) && (
                          <div className="col-span-2 bg-gray-900/80 p-2 rounded border border-gray-800 flex items-center justify-between">
                            <div className="min-w-0 pr-2">
                              <span className="text-[10px] text-gray-400 block">{t("Próximo Hito / Seguimiento:")}</span>
                              <span className="text-amber-300 font-semibold text-[11px] truncate block">
                                {fm.next_followup_action || 'Seguimiento operativo general'}
                              </span>
                            </div>
                            {fm.next_followup_date && (
                              <span className="text-[10px] px-2 py-0.5 rounded bg-amber-950 border border-amber-800 text-amber-300 font-bold shrink-0">
                                {fm.next_followup_date}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* 1. Mini-Galería Visual (2 a 3 fotos dinámicas de la entidad) */}
                    {galleryPhotos.length > 0 && (
                      <div className="mb-3 bg-gray-950/80 border border-gray-800 rounded-xl p-3 shadow-lg">
                        <div className="flex items-center justify-between text-[11px] font-mono font-bold text-sky-400 mb-2">
                          <span className="flex items-center gap-1.5">
                            <span>Registro Visual & Evidencia Fotográfica ({galleryPhotos.length})</span>
                          </span>
                          <span className="text-[9px] text-gray-500 uppercase tracking-wider">{t("Activos en Vivo")}</span>
                        </div>
                        <div className={`grid gap-2 ${galleryPhotos.length === 1 ? 'grid-cols-1' : galleryPhotos.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
                          {galleryPhotos.map((src, idx) => (
                            <div
                              key={idx}
                              className="group relative h-24 rounded-lg overflow-hidden border border-gray-800 bg-gray-900/90 flex items-center justify-center p-1.5 hover:border-sky-500 transition-all shadow"
                            >
                              <img
                                src={getPhotoUrlWithBust(src, fm.updated_at || fm.updatedAt) || src}
                                alt={`Visual ${idx + 1}`}
                                className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
                                onError={(e) => {
                                  (e.target as HTMLElement).style.display = 'none';
                                }}
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-1.5">
                                <span className="text-[9px] text-white font-mono truncate">
                                  {src.split('/').pop()?.replace(/[-_]/g, ' ')}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* 2. Hub de Acciones & Calls Rápidos (CTAs Ejecutivos Directos) */}
                    <div className="mb-3 bg-gradient-to-r from-sky-950/70 via-gray-900 to-indigo-950/70 border border-sky-600/40 rounded-xl p-3 shadow-lg">
                      <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-sky-400 font-bold mb-2">
                        <span className="flex items-center gap-1.5">
                          <span>{t("Hub de Acciones Ejecutivas Inmediatas")}</span>
                        </span>
                        <span className="text-gray-400">{t("Canales Directos")}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {contactWa ? (
                          <a
                            href={`https://wa.me/${contactWa.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hola, te contacto desde la Dirección de Exportaciones de SM Jaleel respecto al estatus y requerimientos de ${node.title}.`)}`}
                            target="_blank"
                            rel="noreferrer"
                            className="px-2.5 py-1.5 bg-emerald-900/80 hover:bg-emerald-800 text-emerald-200 border border-emerald-700/80 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1.5 transition shadow truncate"
                          >
                            <span className="truncate">{t("Escribir WhatsApp")}</span>
                          </a>
                        ) : (
                          <button
                            onClick={() => {
                              setStatusMessage(`Solicitando WhatsApp para ${node.title} a Dots...`);
                              setTimeout(() => setStatusMessage(null), 3000);
                            }}
                            className="px-2.5 py-1.5 bg-gray-800/80 hover:bg-gray-700 text-gray-300 border border-gray-700 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1.5 transition truncate"
                          >
                            <span className="truncate">{t("Pedir WhatsApp")}</span>
                          </button>
                        )}

                        {contactEmail ? (
                          <a
                            href={`mailto:${contactEmail}?subject=${encodeURIComponent(`Actualización Operativa SM Jaleel - ${node.title}`)}&body=${encodeURIComponent(`Estimado equipo,\n\nFavor remitir confirmación y actualización operativa respecto a ${node.title}.\n\nSaludos cordiales,\nDirección Ejecutiva de Exportaciones SM Jaleel`)}`}
                            className="px-2.5 py-1.5 bg-sky-900/80 hover:bg-sky-800 text-sky-200 border border-sky-700/80 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1.5 transition shadow truncate"
                          >
                            <span className="truncate">{t("Enviar Correo")}</span>
                          </a>
                        ) : (
                          <button
                            onClick={() => {
                              setStatusMessage(`Solicitando correo oficial para ${node.title} a Dots...`);
                              setTimeout(() => setStatusMessage(null), 3000);
                            }}
                            className="px-2.5 py-1.5 bg-gray-800/80 hover:bg-gray-700 text-gray-300 border border-gray-700 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1.5 transition truncate"
                          >
                            <span className="truncate">{t("Pedir Correo")}</span>
                          </button>
                        )}

                        <button
                          onClick={() => {
                            setStatusMessage(`Solicitud enviada a Dots: "Actualizar inventario, forecast y acuerdos para ${node.title}"`);
                            setTimeout(() => setStatusMessage(null), 4000);
                          }}
                          className="col-span-2 px-3 py-1.5 bg-indigo-900/70 hover:bg-indigo-800 text-indigo-200 border border-indigo-700/80 rounded-lg text-[11px] font-semibold flex items-center justify-center gap-1.5 transition shadow"
                        >
                          <span className="truncate">{t("Solicitar a Dots Actualizar Estatus & Tareas")}</span>
                        </button>
                      </div>
                    </div>

                    {/* 3. Área de Observaciones Ejecutivas (Elegante y Sin Desorden) */}
                    {fm.executive_observations && (
                      <div className="mb-3 bg-gradient-to-br from-amber-950/40 via-gray-900/90 to-gray-950 border border-amber-500/40 rounded-xl p-3.5 shadow-lg">
                        <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-amber-400 font-bold mb-1.5">
                          <span className="flex items-center gap-1.5">
                            <span>{t("Observaciones Estratégicas & Status Operacional")}</span>
                          </span>
                          <span className="px-1.5 py-0.2 text-[9px] bg-amber-950 border border-amber-800 text-amber-300 rounded font-mono font-bold">
                            {t("HB Validado")}
                          </span>
                        </div>
                        <p className="text-xs text-gray-200 leading-relaxed font-sans border-l-2 border-amber-500/70 pl-2.5 my-1">
                          {fm.executive_observations}
                        </p>
                      </div>
                    )}

                    {/* 4. Bitácora de Últimas Acciones & Correos Registrados (Timeline Logs) */}
                    {Array.isArray(fm.recent_actions) && fm.recent_actions.length > 0 && (
                      <div className="mb-3 bg-gray-950/80 border border-gray-800 rounded-xl p-3.5 shadow-lg">
                        <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-sky-400 font-bold mb-2.5">
                          <span className="flex items-center gap-1.5">
                            <span>{t("Bitácora de Acciones & Logs Registrados")}</span>
                          </span>
                          <span className="text-[9px] text-gray-400 font-mono">{t("Últimas 72h")}</span>
                        </div>
                        <div className="space-y-2.5 border-l border-sky-500/30 ml-2 pl-3">
                          {fm.recent_actions.map((act: any, idx: number) => {
                            const isObj = typeof act === 'object' && act !== null;
                            const dateStr = isObj ? act.date : 'Reciente';
                            const rawType = isObj ? (act.type || 'acción').toLowerCase() : 'nota';
                            const summaryStr = isObj ? (act.summary || act.detail || JSON.stringify(act)) : String(act);

                            const isEmail = rawType.includes('email') || rawType.includes('correo');
                            const isMeeting = rawType.includes('reunion') || rawType.includes('meeting');
                            const isLogistics = rawType.includes('sop') || rawType.includes('forecast') || rawType.includes('embarque');
                            const isCall = rawType.includes('call') || rawType.includes('whatsapp') || rawType.includes('llamada');

                            const dotBg = isEmail ? 'bg-emerald-400' : isMeeting ? 'bg-sky-400' : isLogistics ? 'bg-indigo-400' : isCall ? 'bg-teal-400' : 'bg-amber-400';
                            const badgeClass = isEmail
                              ? 'text-emerald-300 bg-emerald-950/80 border-emerald-800/60'
                              : isMeeting
                              ? 'text-sky-300 bg-sky-950/80 border-sky-800/60'
                              : isLogistics
                              ? 'text-indigo-300 bg-indigo-950/80 border-indigo-800/60'
                              : isCall
                              ? 'text-teal-300 bg-teal-950/80 border-teal-800/60'
                              : 'text-amber-300 bg-amber-950/80 border-amber-800/60';

                            const iconEmoji = '•';

                            return (
                              <div key={idx} className="relative group">
                                <span className={`absolute -left-[17px] top-1.5 w-2 h-2 rounded-full ${dotBg} border border-gray-950 group-hover:scale-125 transition`} />
                                <div className="flex items-center gap-2 mb-0.5">
                                  <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded border font-bold flex items-center gap-1 ${badgeClass}`}>
                                    <span>{iconEmoji}</span>
                                    <span>{dateStr}</span>
                                  </span>
                                  <span className="text-[9px] font-mono uppercase text-gray-400 tracking-wider">
                                    {rawType.replace(/_/g, ' ')}
                                  </span>
                                </div>
                                <p className="text-xs text-gray-200 leading-snug">
                                  {summaryStr}
                                </p>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* 5. Tareas & Pendientes Operativos */}
                    {Array.isArray(fm.pending_tasks) && fm.pending_tasks.length > 0 && (
                      <div className="mb-3 bg-gray-950/80 border border-emerald-900/50 rounded-xl p-3 shadow-lg">
                        <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-bold mb-2">
                          <span className="flex items-center gap-1.5">
                            <span>Tareas & Pendientes Operativos ({fm.pending_tasks.length})</span>
                          </span>
                          <span className="px-1.5 py-0.2 text-[9px] bg-emerald-950 border border-emerald-800 text-emerald-300 rounded font-mono font-bold">
                            {t("En Seguimiento")}
                          </span>
                        </div>
                        <div className="space-y-1.5">
                          {fm.pending_tasks.map((taskItem: any, idx: number) => {
                            const taskText = typeof taskItem === 'object' ? (taskItem.task || taskItem.description || JSON.stringify(taskItem)) : String(taskItem);
                            return (
                              <div key={idx} className="flex items-start gap-2 p-1.5 rounded bg-gray-900/80 border border-gray-800 text-[11px] font-mono">
                                <span className="text-gray-200 leading-snug">{taskText}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Country/distributor bridge: explicit commercial edges, no geography defaults. */}
                    {node.type === 'market' && (() => {
                      const linkedDistributors = getMarketDistributors(
                        node.id,
                        graphData?.allNodes || graphData?.nodes || nodesRef.current || [],
                        graphData?.links || linksRef.current || []
                      );
                      return (
                        <div className="bg-gradient-to-r from-teal-950/80 to-emerald-950/80 border border-teal-500/60 rounded-xl p-3 mb-3 shadow-lg">
                          <span className="text-[10px] font-mono uppercase tracking-wider text-teal-400 font-bold block">
                            {linkedDistributors.length > 1 ? 'Distribuidores vinculados' : linkedDistributors.length === 1 ? 'Distribuidor vinculado' : 'Distribuidor pendiente'}
                          </span>
                          {linkedDistributors.length === 0 ? (
                            <span className="text-xs font-bold text-white">{marketDistributorLabel([])}</span>
                          ) : linkedDistributors.map(distributor => (
                            <div key={distributor.id} className="flex items-center justify-between gap-2 mt-2">
                              <span className="text-xs font-bold text-white">{distributorDisplayName(distributor)}</span>
                              <button
                                onClick={() => pushToStackedDeck(distributor as NodeData)}
                                className="px-2.5 py-1 bg-teal-600 hover:bg-teal-500 text-white text-[11px] font-semibold rounded shadow transition flex items-center gap-1 shrink-0"
                              >
                                <span>{t("Abrir Distribuidor")}</span>
                                <span aria-hidden="true">→</span>
                              </button>
                            </div>
                          ))}
                        </div>
                      );
                    })()}

                    {node.type === 'distributor' && (() => {
                      const allNodes = graphData?.nodes || nodesRef.current || [];
                      const allLinks = graphData?.links || linksRef.current || [];
                      const linkedMktNode = allNodes.find((n: any) => {
                        if (n.type !== 'market') return false;
                        const isLinked = allLinks.some((l: any) => {
                          const s = typeof l.source === 'object' ? l.source.id : l.source;
                          const t = typeof l.target === 'object' ? l.target.id : l.target;
                          return (s === node.id && t === n.id) || (s === n.id && t === node.id);
                        });
                        const nFm = node.frontmatter || {};
                        const rels = nFm.relations || {};
                        const belongsTo = JSON.stringify(rels.belongs_to_market || '') + JSON.stringify(nFm.market || '');
                        return isLinked || belongsTo.toLowerCase().includes(n.id.toLowerCase());
                      });

                      const mktTitle = linkedMktNode
                        ? (linkedMktNode.frontmatter?.country_name || linkedMktNode.title.replace(/^Market:\s*/i, ''))
                        : (node.id.includes('sancas') ? 'Belice (CARICOM / Arancel 0%)' :
                           node.id.includes('medimex') || node.id.includes('panama') ? 'Panamá (Hub Logístico Centroamérica)' :
                           node.id.includes('morgan') || node.id.includes('canada') ? 'Canadá (Retail & Mass Market)' :
                           'Estados Unidos (Costa Este)');

                      return (
                        <div className="bg-gradient-to-r from-emerald-950/80 to-sky-950/80 border border-emerald-500/60 rounded-xl p-3 mb-3 shadow-lg">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                              <div>
                                <span className="text-[10px] font-mono uppercase tracking-wider text-emerald-400 font-bold block">
                                  {t("Territorio de Mercado Asignado")}
                                </span>
                                <span className="text-xs font-bold text-white">
                                  {mktTitle}
                                </span>
                              </div>
                            </div>
                            {linkedMktNode && (
                              <button
                                onClick={() => pushToStackedDeck(linkedMktNode)}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-semibold rounded shadow transition flex items-center gap-1 shrink-0"
                              >
                                <span>{t("Ver País")}</span>
                                <span>→</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })()}

                    <CommercialConnections
                      node={node}
                      nodes={graphData?.allNodes || graphData?.nodes || nodesRef.current || []}
                      links={graphData?.links || linksRef.current || []}
                      onOpen={(target, sourceId) => pushToStackedDeck(target as NodeData, false, sourceId)}
                    />
                    {node.type === 'person' && <ContactLayer
                      node={node}
                      nodes={graphData?.allNodes || graphData?.nodes || nodesRef.current || []}
                      links={graphData?.links || linksRef.current || []}
                      onOpen={(target, sourceId) => pushToStackedDeck(target as NodeData, false, sourceId)}
                    />}
                    <PortfolioConnections
                      node={node}
                      nodes={graphData?.allNodes || graphData?.nodes || nodesRef.current || []}
                      links={graphData?.links || linksRef.current || []}
                      onOpen={(target, sourceId) => pushToStackedDeck(target as NodeData, false, sourceId)}
                    />

                    {/* Ficha Ejecutiva Especializada para Distribuidores (100% Datos, 0 Opiniones) */}
                    {node.type === 'distributor' && (
                      <div className="bg-gradient-to-br from-emerald-950/80 via-gray-900 to-gray-950 border border-emerald-500/50 rounded-xl p-3.5 mb-3 text-xs space-y-2.5 shadow-lg">
                        <div className="flex items-center justify-between text-emerald-400 font-bold uppercase tracking-wider text-[10px]">
                          <span className="flex items-center gap-1.5">
                            <span>{t("Ficha del distribuidor")}</span>
                          </span>
                          <span className="px-1.5 py-0.5 text-[9px] bg-emerald-950 border border-emerald-700 text-emerald-300 rounded font-mono font-bold">
                            {fm.commercial_status_label || (fm.is_active !== false ? 'Vinculado' : 'Por verificar / Histórico')}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                          <div className="col-span-2">
                            <span className="text-gray-400">{t("Razón Social:")}</span>{' '}
                            <span className="text-white font-bold">{fm.legal_name || fm.company_name || node.title.replace(/^Distributor:\s*/i, '')}</span>
                          </div>
                          {fm.based_in_city && (
                            <div>
                              <span className="text-gray-400">{t("Sede Operativa:")}</span>{' '}
                              <span className="text-white">{fm.based_in_city}, {fm.based_in_country || 'Panamá'}</span>
                            </div>
                          )}
                          {fm.incoterm && (
                            <div>
                              <span className="text-gray-400">{t("Incoterm:")}</span>{' '}
                              <span className="text-amber-300 font-semibold">{fm.incoterm}</span>
                            </div>
                          )}
                          {fm.payment_terms && (
                            <div>
                              <span className="text-gray-400">{t("Crédito / Pago:")}</span>{' '}
                              <span className="text-sky-300">{fm.payment_terms}</span>
                            </div>
                          )}
                          {fm.headquarters_address && (
                            <div className="col-span-2">
                              <span className="text-gray-400">{t("Dirección:")}</span>{' '}
                              <span className="text-gray-300">{fm.headquarters_address}</span>
                            </div>
                          )}
                        </div>
                        <div className="pt-2 border-t border-gray-800 flex flex-wrap items-center justify-between gap-1 text-[11px] font-mono">
                          <span className="text-gray-400">{t("Canales Directos:")}</span>
                          <div className="flex items-center gap-2">
                            {fm.phone_main && <span className="text-white">{fm.phone_main}</span>}
                            {fm.email_orders && <a href={`mailto:${fm.email_orders}`} className="text-teal-400 hover:underline">{fm.email_orders}</a>}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Ficha Ejecutiva Especializada para Mercados */}
                    {node.type === 'market' && (
                      <div className="bg-gradient-to-br from-teal-950/80 via-gray-900 to-gray-950 border border-teal-500/50 rounded-xl p-3.5 mb-3 text-xs space-y-2.5 shadow-lg">
                        <div className="flex items-center justify-between text-teal-400 font-bold uppercase tracking-wider text-[10px]">
                          <span className="flex items-center gap-1.5">
                            <span>{t("Ficha de Mercado Exterior & Operaciones")}</span>
                          </span>
                          <span className="px-1.5 py-0.5 text-[9px] bg-teal-950 border border-teal-700 text-teal-300 rounded font-mono font-bold">
                            {fm.region || 'Región Internacional'}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                          <div>
                            <span className="text-gray-400">{t("País:")}</span>{' '}
                            <span className="text-white font-bold">{fm.country_name || node.title.replace(/^Market:\s*/i, '')}</span>
                          </div>
                          <div>
                            <span className="text-gray-400">{t("Moneda:")}</span>{' '}
                            <span className="text-emerald-300 font-semibold">{fm.currency || 'USD'}</span>
                          </div>
                          {fm.transit_time_from_trinidad_days && (
                            <div>
                              <span className="text-gray-400">{t("Tránsito Marítimo:")}</span>{' '}
                              <span className="text-sky-300 font-bold">{fm.transit_time_from_trinidad_days} días desde Trinidad</span>
                            </div>
                          )}
                          {fm.regulatory_authority && (
                            <div className="col-span-2">
                              <span className="text-gray-400">{t("Autoridad Sanitaria:")}</span>{' '}
                              <span className="text-amber-300">{fm.regulatory_authority}</span>
                            </div>
                          )}
                          {fm.primary_ports && Array.isArray(fm.primary_ports) && (
                            <div className="col-span-2">
                              <span className="text-gray-400">{t("Puertos de Arribo:")}</span>{' '}
                              <span className="text-white">{fm.primary_ports.join(' · ')}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Specialized Executive Dossiers by Entity Type */}
                    {node.type === 'core' && (
                      <div className="bg-gradient-to-br from-amber-950/80 via-gray-900 to-gray-950 border border-amber-500/50 rounded-xl p-3.5 mb-3 text-xs space-y-2.5 shadow-lg">
                        <div className="flex items-center gap-2 text-amber-400 font-bold uppercase tracking-wider text-[10px]">
                          <span>{t("Ficha Institucional · Casa Matriz SM Jaleel & Co. Ltd.")}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                          <div><span className="text-gray-400">{t("Razón Social:")}</span> <span className="text-white font-medium">S.M. Jaleel & Co. Ltd.</span></div>
                          <div><span className="text-gray-400">{t("Fundación:")}</span> <span className="text-amber-300 font-medium">1924 (102 años de historia)</span></div>
                          <div className="col-span-2"><span className="text-gray-400">{t("Sede Global:")}</span> <span className="text-white">Otaheite Industrial Estate, South Oropouche, Trinidad & Tobago</span></div>
                          <div className="col-span-2"><span className="text-gray-400">{t("Giro de Negocio:")}</span> <span className="text-white">Manufactura, embotellado y exportación de bebidas no alcohólicas</span></div>
                          <div><span className="text-gray-400">{t("Alcance de Exportación:")}</span> <span className="text-emerald-400 font-medium">+60 países</span></div>
                          <div><span className="text-gray-400">{t("Liderazgo Operativo:")}</span> <span className="text-sky-300 font-medium">Anna Mohammed (COO)</span></div>
                        </div>
                        <div className="pt-2 border-t border-gray-800 text-[11px]">
                          <span className="text-gray-400 font-mono">{t("Portafolio Clave:")}</span>{' '}
                          <span className="text-amber-200 font-semibold">Chubby · Busta · Fruta · Oasis · Altitude</span>
                        </div>
                      </div>
                    )}

                    {node.type === 'organization' && (
                      <div className="bg-gradient-to-br from-emerald-950/80 via-gray-900 to-gray-950 border border-emerald-500/50 rounded-xl p-3.5 mb-3 text-xs space-y-2.5 shadow-lg">
                        <div className="flex items-center gap-2 text-emerald-400 font-bold uppercase tracking-wider text-[10px]">
                          <span>{t("Ficha Institucional · Filial Corporativa Internacional")}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                          <div className="col-span-2">
                            <span className="text-gray-400">{t("Razón Social:")}</span> <span className="text-white font-bold">{node.title}</span>
                          </div>
                          <div>
                            <span className="text-gray-400">{t("Entidad:")}</span> <span className="text-emerald-300 font-medium">Filial Directa SMJ</span>
                          </div>
                          <div>
                            <span className="text-gray-400">{t("Estatus:")}</span> <span className="text-sky-300">Activo / Operacional</span>
                          </div>
                          {fm.country && (
                            <div><span className="text-gray-400">{t("País Sede:")}</span> <span className="text-white">{fm.country}</span></div>
                          )}
                          <div className="col-span-2 pt-1 border-t border-gray-800 flex items-center justify-between">
                            <span className="text-gray-400">{t("Casa Matriz:")}</span>
                            <span className="text-amber-400 font-medium">S.M. Jaleel & Co. Ltd. (Trinidad)</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {node.type === 'person' && (() => {
                      const allNodes = graphData?.nodes || nodesRef.current || [];
                      const allLinks = graphData?.links || linksRef.current || [];
                      const pName = node.title.replace('Person: ', '');
                      const isCommercialContact = contactEntities(node, graphData?.allNodes || allNodes, allLinks).length > 0;
                      const isLeader = !isCommercialContact && isNodeLeader(node);

                      // Find direct reports (subordinates or people linked to this leader)
                      const directReports = allNodes.filter((n: any) => {
                        if (n.type !== 'person' || n.id === node.id) return false;
                        const rTo = String(n.frontmatter?.reports_to || '').toLowerCase();
                        if (rTo && (rTo.includes(node.id.replace('person-', '')) || rTo.includes(pName.toLowerCase().split(' ')[0]))) return true;
                        const hasLink = allLinks.some((l: any) => {
                          const s = typeof l.source === 'string' ? l.source : l.source.id;
                          const t = typeof l.target === 'string' ? l.target : l.target.id;
                          return s === n.id && t === node.id && (l.relationType === 'reports_to' || l.relationType === 'managed_by');
                        });
                        return hasLink;
                      });

                      const isLeaderAccordionOpen = expandedLeaderInDossier === node.id;

                      return (
                        <div className="space-y-3 mb-3">
                          <div className="bg-gradient-to-br from-indigo-950/80 via-gray-900 to-gray-950 border border-indigo-500/50 rounded-xl p-3.5 text-xs space-y-2.5 shadow-lg">
                            <div className="flex items-center gap-2 text-indigo-400 font-bold uppercase tracking-wider text-[10px]">
                              <span>{isCommercialContact ? 'Contacto comercial' : 'Ficha de Perfil Ejecutivo & Línea de Mando'}</span>
                              {isLeader && (
                                <span className="ml-auto px-1.5 py-0.5 text-[9px] bg-amber-950 border border-amber-700 text-amber-300 rounded font-mono font-bold">
                                  Liderazgo L{node.hierarchy_level ?? 2}
                                </span>
                              )}
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                              {fm.job_title && (
                                <div className="col-span-2"><span className="text-gray-400">{t("Cargo Oficial:")}</span> <span className="text-sky-300 font-bold">{fm.job_title}</span></div>
                              )}
                              {fm.reports_to && (
                                <div className="col-span-2"><span className="text-gray-400">{t("Reporta a:")}</span> <span className="text-white font-medium">{fm.reports_to}</span></div>
                              )}
                              {fm.based_in_city && (
                                <div><span className="text-gray-400">{t("Ubicación:")}</span> <span className="text-white">{fm.based_in_city}</span></div>
                              )}
                              {fm.timezone && (
                                <div><span className="text-gray-400">{t("Zona Horaria:")}</span> <span className="text-white">{fm.timezone}</span></div>
                              )}
                              {fm.email_primary && (
                                <div className="col-span-2"><span className="text-gray-400">{t("Email Directo:")}</span> <span className="text-sky-300 select-all">{fm.email_primary}</span></div>
                              )}
                            </div>
                          </div>

                          {/* Accordion for Direct Reports if person has team members */}
                          {directReports.length > 0 && (
                            <div className="border border-indigo-500/50 rounded-xl bg-gray-950/90 p-3 shadow-lg">
                              <button
                                onClick={() => setExpandedLeaderInDossier(isLeaderAccordionOpen ? null : node.id)}
                                className="w-full flex items-center justify-between text-xs font-bold text-indigo-300 hover:text-indigo-200 transition select-none"
                              >
                                <div className="flex items-center gap-2">
                                  <span>Equipo a Cargo & Reportes Directos ({directReports.length})</span>
                                </div>
                                <span className="text-[11px] px-2 py-0.5 rounded bg-indigo-950 border border-indigo-800 text-indigo-300 font-mono">
                                  {isLeaderAccordionOpen ? '▲ Encoger' : '▼ Desplegar'}
                                </span>
                              </button>

                              {isLeaderAccordionOpen && (
                                <div className="mt-3 pt-3 border-t border-gray-800 space-y-1.5 animate-in fade-in duration-150 max-h-48 overflow-y-auto pr-1">
                                  {directReports.map((sub: any) => (
                                    <button
                                      key={sub.id}
                                      onClick={() => pushToStackedDeck(sub)}
                                      className="w-full text-left text-[11px] font-mono px-2 py-1.5 rounded bg-gray-900/90 border border-gray-800 hover:border-indigo-400 text-gray-200 hover:text-white transition flex items-center justify-between"
                                    >
                                      <span className="truncate">{sub.title.replace('Person: ', '')} {sub.frontmatter?.job_title ? `· ${sub.frontmatter.job_title}` : ''}</span>
                                      <span className="text-[9px] text-indigo-400 shrink-0 ml-1">→</span>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {node.type === 'department' && (() => {
                      const deptKey = node.id.includes('export')
                        ? 'exports'
                        : node.id.includes('manufacturing') || node.id.includes('plant')
                        ? 'manufacturing'
                        : node.id.includes('supply') || node.id.includes('procurement')
                        ? 'supply_chain'
                        : node.id.includes('marketing')
                        ? 'marketing'
                        : node.id.includes('legal')
                        ? 'legal'
                        : node.id.includes('business-intelligence')
                        ? 'business_intelligence'
                        : node.id.includes('information-technology') || node.id.includes('-it')
                        ? 'information_technology'
                        : node.id.includes('internal-audit')
                        ? 'internal_audit'
                        : node.id.includes('finance')
                        ? 'finance'
                        : 'general';

                      const allNodes = (graphData as any)?.allNodes || graphData?.nodes || nodesRef.current || [];
                      const obsContacts: string[] = Array.isArray(fm.relations?.observed_contacts) ? fm.relations.observed_contacts : [];
                      const headName = String(fm.head_of_department || '').toLowerCase();
                      const deptIdClean = node.id.replace('dept-', '').toLowerCase();
                      const deptTitleClean = node.title.replace('Department: ', '').toLowerCase();

                      const deptMembers = allNodes.filter((n: any) => {
                        if (n.type !== 'person') return false;
                        const pName = n.title.replace('Person: ', '').toLowerCase();
                        const pIdClean = n.id.replace('person-', '').toLowerCase();
                        const pDept = String(n.frontmatter?.department || n.department || '').toLowerCase();
                        const pReportsTo = String(n.frontmatter?.reports_to || '').toLowerCase();

                        // 1. Observed contacts in department markdown frontmatter
                        if (obsContacts.some(c => c.toLowerCase().includes(pName) || c.toLowerCase().includes(pIdClean))) return true;

                        // 2. Direct frontmatter department specification
                        if (pDept && (pDept.includes(deptIdClean) || pDept.includes(deptTitleClean))) return true;

                        // 3. Supervisor tree (reports directly to the head of this department)
                        if (headName && headName.length > 3 && pReportsTo && pReportsTo.includes(headName.split(' ')[0])) return true;

                        // 4. Categorized match (only if specific and matches verified department)
                        if (deptKey !== 'general' && getPersonDeptCategory(n) === deptKey) return true;

                        return false;
                      });
                      const deptLeaders = deptMembers.filter((p: any) => isNodeLeader(p));
                      const deptStaff = deptMembers.filter((p: any) => !isNodeLeader(p));
                      const isDeptAccordionOpen = expandedDeptInDossier === node.id;

                      return (
                        <div className="space-y-3 mb-3">
                          <div className="bg-gradient-to-br from-blue-950/80 via-gray-900 to-gray-950 border border-blue-500/50 rounded-xl p-3.5 text-xs space-y-2.5 shadow-lg">
                            <div className="flex items-center gap-2 text-sky-400 font-bold uppercase tracking-wider text-[10px]">
                              <span>{t("Ficha Departamental Corporativa")}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                              {fm.head_of_department && (
                                <div className="col-span-2"><span className="text-gray-400">{t("Líder / Responsable:")}</span> <span className="text-sky-300 font-bold">{fm.head_of_department}</span></div>
                              )}
                              {fm.mandate && (
                                <div className="col-span-2"><span className="text-gray-400">{t("Mandato:")}</span> <span className="text-white">{fm.mandate}</span></div>
                              )}
                              {fm.reports_to && (
                                <div className="col-span-2"><span className="text-gray-400">{t("Reporta a:")}</span> <span className="text-gray-300">{fm.reports_to}</span></div>
                              )}
                            </div>
                          </div>

                          {/* Collapsible Accordion for Department Team */}
                          <div className="border border-sky-500/50 rounded-xl bg-gray-950/90 p-3 shadow-lg">
                            <button
                              onClick={() => setExpandedDeptInDossier(isDeptAccordionOpen ? null : node.id)}
                              className="w-full flex items-center justify-between text-xs font-bold text-sky-300 hover:text-sky-200 transition select-none"
                            >
                              <div className="flex items-center gap-2">
                                <span>Equipo & Colaboradores ({deptMembers.length} personas)</span>
                              </div>
                              <span className="text-[11px] px-2 py-0.5 rounded bg-sky-950 border border-sky-800 text-sky-300 font-mono">
                                {isDeptAccordionOpen ? '▲ Encoger' : '▼ Desplegar'}
                              </span>
                            </button>

                            {isDeptAccordionOpen && (
                              <div className="mt-3 pt-3 border-t border-gray-800 space-y-3 animate-in fade-in duration-150">
                                {deptLeaders.length > 0 && (
                                  <div>
                                    <div className="text-[10px] font-mono uppercase text-sky-400 font-bold mb-1.5 flex items-center justify-between">
                                      <span>Jefatura & Liderazgo ({deptLeaders.length})</span>
                                      <span className="text-[9px] text-gray-500">{t("Clic para abrir")}</span>
                                    </div>
                                    <div className="space-y-1">
                                      {deptLeaders.map((p: any) => (
                                        <button
                                          key={p.id}
                                          onClick={() => pushToStackedDeck(p)}
                                          className="w-full text-left text-[11px] font-mono px-2.5 py-1.5 rounded bg-sky-950/60 border border-sky-800/80 hover:border-sky-400 text-white transition flex items-center justify-between"
                                        >
                                          <span className="truncate"><strong>{p.title.replace('Person: ', '')}</strong> {p.frontmatter?.job_title ? `· ${p.frontmatter.job_title}` : ''}</span>
                                          <span className="text-sky-400 text-xs ml-1">→</span>
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {deptStaff.length > 0 && (
                                  <div>
                                    <div className="text-[10px] font-mono uppercase text-gray-400 font-bold mb-1.5 flex items-center justify-between">
                                      <span>Colaboradores & Especialistas ({deptStaff.length})</span>
                                      <span className="text-[9px] text-gray-500">{t("Clic para abrir")}</span>
                                    </div>
                                    <div className="grid grid-cols-1 gap-1 max-h-48 overflow-y-auto pr-1">
                                      {deptStaff.map((p: any) => (
                                        <button
                                          key={p.id}
                                          onClick={() => pushToStackedDeck(p)}
                                          className="text-left text-[11px] font-mono px-2 py-1 rounded bg-gray-900/90 border border-gray-800 hover:border-sky-500 text-gray-200 hover:text-white transition truncate flex items-center justify-between"
                                        >
                                          <span className="truncate">{p.title.replace('Person: ', '')} {p.frontmatter?.job_title ? `· ${p.frontmatter.job_title}` : ''}</span>
                                          <span className="text-[9px] text-sky-400 shrink-0 ml-1">→</span>
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                <button
                                  onClick={() => handleSetOrgScope(deptKey as any)}
                                  className="w-full py-1.5 px-3 bg-sky-900/60 hover:bg-sky-800 border border-sky-600 rounded text-sky-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition"
                                >
                                  <span>{t("Desplegar Equipo en el Lienzo")}</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}

                    {node.type === 'customer' && (
                      <div className="bg-gradient-to-br from-cyan-950/80 via-gray-900 to-gray-950 border border-cyan-500/50 rounded-xl p-3.5 mb-3 text-xs space-y-2.5 shadow-lg">
                        <div className="flex items-center gap-2 text-cyan-400 font-bold uppercase tracking-wider text-[10px]">
                          <span>{t("Ficha de Cliente Clave / Gran Cuenta")}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                          {fm.channel && (
                            <div><span className="text-gray-400">{t("Canal:")}</span> <span className="text-white font-medium">{fm.channel}</span></div>
                          )}
                          {fm.primary_market && (
                            <div><span className="text-gray-400">{t("Mercado:")}</span> <span className="text-white font-medium">{fm.primary_market}</span></div>
                          )}
                          {fm.payment_terms && (
                            <div><span className="text-gray-400">{t("Términos Pago:")}</span> <span className="text-amber-300">{fm.payment_terms}</span></div>
                          )}
                          {fm.edi_system && (
                            <div><span className="text-gray-400">{t("Sistema EDI:")}</span> <span className="text-sky-300">{fm.edi_system}</span></div>
                          )}
                        </div>
                      </div>
                    )}

                    {node.type === 'brand' && (() => {
                      const brandKey = node.id.replace('brand-', '').toLowerCase();
                      const allCatalogNodes = graphData?.allNodes || graphData?.nodes || [];
                      const brandSubNodes = brandCatalogNodes(node.id, allCatalogNodes, graphData?.links || []);
                      const packNodes = brandSubNodes.filter(n => n.type === 'packaging');
                      const variantNodes = brandSubNodes.filter(n => n.type === 'product_variant');
                      const flavorNodes = brandSubNodes.filter(n => n.type === 'flavor');
                      const isAccordionOpen = expandedBrandInDossier === node.id;

                      return (
                        <div className="space-y-3 mb-3">
                          {/* Quick Master Brands Switcher Bar */}
                          <div className="flex items-center gap-1.5 p-1.5 bg-gray-950/90 border border-gray-800 rounded-lg overflow-x-auto">
                            <span className="text-[10px] text-gray-500 font-mono pl-1 shrink-0">{t("Marcas:")}</span>
                            {allCatalogNodes.filter((n: any) => n.type === 'brand').map((b: any) => (
                              <button
                                key={b.id}
                                onClick={() => {
                                  const targetBrand = allCatalogNodes.find((n: any) => n.id === b.id);
                                  if (targetBrand) pushToStackedDeck(targetBrand);
                                }}
                                className={`px-2 py-0.5 rounded text-[10px] font-mono flex items-center gap-1 transition shrink-0 ${
                                  node.id === b.id
                                    ? 'bg-amber-600 text-white font-bold shadow'
                                    : 'text-gray-400 hover:text-white hover:bg-gray-800'
                                }`}
                              >
                                <span>{b.frontmatter?.brand_name || b.title.replace(/^Brand:\s*/i, '')}</span>
                              </button>
                            ))}
                          </div>

                          <div className="bg-gradient-to-br from-orange-950/80 via-gray-900 to-gray-950 border border-orange-500/50 rounded-xl p-3.5 text-xs space-y-2.5 shadow-lg">
                            <div className="flex items-center gap-2 text-orange-400 font-bold uppercase tracking-wider text-[10px]">
                              <span>{t("Ficha de Portafolio de Marca & Producción")}</span>
                            </div>
                            {fm.tagline && (
                              <div className="text-xs text-amber-200 italic font-medium pb-1 border-b border-gray-800">
                                &ldquo;{fm.tagline}&rdquo;
                              </div>
                            )}
                            <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                              <div><span className="text-gray-400">{t("Planta de Origen:")}</span> <span className="text-white font-medium">{fm.manufacturing_plant ? String(fm.manufacturing_plant).replace(/[[\]]/g, '') : 'Por confirmar'}</span></div>
                              <div><span className="text-gray-400">{t("Categoría:")}</span> <span className="text-white font-medium">{fm.category || 'Bebidas SMJ'}</span></div>
                              {fm.shelf_life_months && (
                                <div><span className="text-gray-400">{t("Vida Útil:")}</span> <span className="text-emerald-400 font-medium">{fm.shelf_life_months} meses</span></div>
                              )}
                              {fm.units_per_case && (
                                <div><span className="text-gray-400">{t("Unidades/Caja:")}</span> <span className="text-sky-300 font-medium">{formatDisplayValue(fm.units_per_case)}</span></div>
                              )}
                              {fm.cases_per_20ft_container && (
                                <div><span className="text-gray-400">{t("Contenedor 20ft:")}</span> <span className="text-amber-300 font-medium">{formatDisplayValue(fm.cases_per_20ft_container)} cajas</span></div>
                              )}
                              {fm.cases_per_40ft_container && (
                                <div><span className="text-gray-400">{t("Contenedor 40ft:")}</span> <span className="text-amber-300 font-medium">{formatDisplayValue(fm.cases_per_40ft_container)} cajas</span></div>
                              )}
                            </div>
                          </div>

                          {/* Collapsible Accordion for Granular SKUs & Multipacks */}
                          <div className="border border-amber-500/50 rounded-xl bg-gray-950/90 p-3 shadow-lg">
                            <button
                              onClick={() => setExpandedBrandInDossier(isAccordionOpen ? null : node.id)}
                              className="w-full flex items-center justify-between text-xs font-bold text-amber-300 hover:text-amber-200 transition select-none"
                            >
                              <div className="flex items-center gap-2">
                                <span>Catálogo de SKUs & Multipacks ({brandSubNodes.length} ítems)</span>
                              </div>
                              <span className="text-[11px] px-2 py-0.5 rounded bg-amber-950 border border-amber-800 text-amber-300 font-mono">
                                {isAccordionOpen ? '▲ Encoger' : '▼ Desplegar'}
                              </span>
                            </button>

                            {isAccordionOpen && (
                              <div className="mt-3 pt-3 border-t border-gray-800 space-y-3 animate-in fade-in duration-150">
                                {packNodes.length > 0 && (
                                  <div>
                                    <div className="text-[10px] font-mono uppercase text-gray-400 font-bold mb-1.5 flex items-center justify-between">
                                      <span>Multipacks & Empaques ({packNodes.length})</span>
                                      <span className="text-[9px] text-gray-500">{t("Clic para abrir")}</span>
                                    </div>
                                    <div className="grid grid-cols-1 gap-1 max-h-40 overflow-y-auto pr-1">
                                      {packNodes.map((p: any) => (
                                        <button
                                          key={p.id}
                                          onClick={() => pushToStackedDeck(p, false, node.id)}
                                          className="text-left text-[11px] font-mono px-2 py-1 rounded bg-gray-900/90 border border-gray-800 hover:border-amber-500 text-gray-200 hover:text-white transition truncate flex items-center justify-between"
                                        >
                                          <span className="truncate">{p.title}</span>
                                          <span className="text-[9px] text-amber-400 shrink-0 ml-1">→</span>
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {variantNodes.length > 0 && (
                                  <div>
                                    <div className="text-[10px] font-mono uppercase text-gray-400 font-bold mb-1.5 flex items-center justify-between">
                                      <span>Variantes & Presentaciones ({variantNodes.length} SKUs)</span>
                                      <span className="text-[9px] text-gray-500">{t("Clic para abrir")}</span>
                                    </div>
                                    <div className="grid grid-cols-1 gap-1 max-h-48 overflow-y-auto pr-1">
                                      {variantNodes.map((v: any) => (
                                        <button
                                          key={v.id}
                                          onClick={() => pushToStackedDeck(v, false, node.id)}
                                          className="text-left text-[11px] font-mono px-2 py-1 rounded bg-gray-900/90 border border-gray-800 hover:border-sky-500 text-gray-200 hover:text-white transition truncate flex items-center justify-between"
                                        >
                                          <span className="truncate">{v.title}</span>
                                          <span className="text-[9px] text-sky-400 shrink-0 ml-1">→</span>
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {flavorNodes.length > 0 && (
                                  <div>
                                    <div className="text-[10px] font-mono uppercase text-gray-400 font-bold mb-1">
                                      Sabores Registrados ({flavorNodes.length}):
                                    </div>
                                    <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                                      {flavorNodes.map((fl: any) => (
                                        <button
                                          key={fl.id}
                                          onClick={() => pushToStackedDeck(fl)}
                                          className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-950/80 border border-emerald-800 text-emerald-300 hover:bg-emerald-900 transition"
                                        >
                                          {fl.title.replace(/^Flavor\s*-\s*/i, '')}
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                <div className="pt-2 border-t border-gray-800 flex items-center justify-between">
                                  <span className="text-[10px] text-gray-400 font-mono">{t("Control en Mapa:")}</span>
                                  <button
                                    onClick={() => handleSetCatalogScope(catalogScope === brandKey ? 'collapsed' : brandKey as any)}
                                    className="text-xs px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white font-semibold rounded shadow transition flex items-center gap-1"
                                  >
                                    <span>{catalogScope === brandKey ? 'Plegar del Lienzo' : 'Desplegar en Lienzo'}</span>
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })()}

                    {node.type === 'packaging' && (
                      <div className="bg-gradient-to-br from-amber-950/80 via-gray-900 to-gray-950 border border-amber-500/50 rounded-xl p-3.5 mb-3 text-xs space-y-2.5 shadow-lg">
                        <div className="flex items-center gap-2 text-amber-400 font-bold uppercase tracking-wider text-[10px]">
                          <span>{t("Ficha de Formato de Empaque & Multi-Pack")}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                          <div className="col-span-2"><span className="text-gray-400">{t("Descripción:")}</span> <span className="text-white font-bold">{node.title}</span></div>
                          <div><span className="text-gray-400">{t("Tipo de Envase:")}</span> <span className="text-amber-300">{packagingDescription(fm).container}</span></div>
                          <div><span className="text-gray-400">{t("Configuración:")}</span> <span className="text-emerald-400">{packagingDescription(fm).configuration}</span></div>
                          <div><span className="text-gray-400">{t("Contenido por unidad:")}</span> <span className="text-white">{packagingDescription(fm).size}</span></div>
                          <div className="col-span-2"><span className="text-gray-400">{t("Fuente:")}</span> <span className="text-gray-300">{fm.source || 'Por documentar'}</span></div>
                          {fm.visual_photo_scope === 'linked_unit_reference_not_case_photo' && <p className="col-span-2 text-gray-300">{t("Imagen de la unidad de referencia; la caja no está fotografiada.")}</p>}
                        </div>
                      </div>
                    )}

                    {node.type === 'product_variant' && (
                      <div className="bg-gradient-to-br from-sky-950/80 via-gray-900 to-gray-950 border border-sky-500/50 rounded-xl p-3.5 mb-3 text-xs space-y-2.5 shadow-lg">
                        <div className="flex items-center gap-2 text-sky-400 font-bold uppercase tracking-wider text-[10px]">
                          <span>{t("Ficha de SKU & Presentación Comercial")}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                          <div className="col-span-2"><span className="text-gray-400">{t("Código en la fuente:")}</span> <span className="text-white font-bold">{fm.sku_raw || fm.source_item_code || 'No publicado'}</span></div>
                          <div><span className="text-gray-400">{t("Presentación:")}</span> <span className="text-sky-300">{fm.size_raw || 'Por documentar'}</span></div>
                          <div><span className="text-gray-400">{t("Unidades/Caja:")}</span> <span className="text-amber-300">{fm.units_per_case_raw || 'Por documentar'}</span></div>
                          <div className="col-span-2"><span className="text-gray-400">{t("Fuente:")}</span> <span className="text-gray-300">{fm.source || 'Por documentar'}</span></div>
                        </div>
                      </div>
                    )}

                    {node.type === 'flavor' && (
                      <div className="bg-gradient-to-br from-emerald-950/80 via-gray-900 to-gray-950 border border-emerald-500/50 rounded-xl p-3.5 mb-3 text-xs space-y-2.5 shadow-lg">
                        <div className="flex items-center gap-2 text-emerald-400 font-bold uppercase tracking-wider text-[10px]">
                          <span>{t("Ficha de Formulación de Sabor SMJ")}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                          <div className="col-span-2"><span className="text-gray-400">{t("Sabor Registrado:")}</span> <span className="text-emerald-300 font-bold">{node.title}</span></div>
                          <div><span className="text-gray-400">{t("Laboratorio:")}</span> <span className="text-white">I+D Trinidad</span></div>
                          <div><span className="text-gray-400">{t("Estado:")}</span> <span className="text-emerald-400">Fórmula Activa</span></div>
                        </div>
                      </div>
                    )}

                    {(node.type === 'routine' || node.type === 'working_memory') && (
                      <div className="bg-gradient-to-br from-amber-950/80 via-gray-900 to-gray-950 border border-amber-500/50 rounded-xl p-3.5 mb-3 text-xs space-y-2.5 shadow-lg">
                        <div className="flex items-center gap-2 text-amber-400 font-bold uppercase tracking-wider text-[10px]">
                          <span>{t("Memoria Operativa S&OP & Cadencia de Negocio")}</span>
                        </div>
                        <div className="text-[11px] font-mono space-y-1">
                          {fm.frequency && <div><span className="text-gray-400">{t("Cadencia:")}</span> <span className="text-white">{fm.frequency}</span></div>}
                          {fm.priority && <div><span className="text-gray-400">{t("Prioridad:")}</span> <span className="text-amber-300 uppercase font-bold">{fm.priority}</span></div>}
                        </div>
                      </div>
                    )}

                    {/* General Metadata Grid (Para entidades sin ficha especializada) */}
                    {node.type !== 'distributor' && node.type !== 'market' && node.type !== 'core' && (
                      <div className="grid grid-cols-2 gap-2 text-xs mb-3 font-mono bg-gray-950/70 p-3 rounded-lg border border-gray-800">
                        {fm.country_name && <div><span className="text-gray-500">{t("País:")}</span> {formatDisplayValue(fm.country_name)}</div>}
                        {fm.based_in_city && <div><span className="text-gray-500">{t("Ciudad:")}</span> {formatDisplayValue(fm.based_in_city)}</div>}
                        {fm.timezone && <div><span className="text-gray-500">{t("Zona H.:")}</span> {formatDisplayValue(fm.timezone)}</div>}
                        {fm.gender && <div><span className="text-gray-500">{t("Género:")}</span> {formatDisplayValue(fm.gender)}</div>}
                        {fm.incoterm && <div><span className="text-gray-500">{t("Incoterm:")}</span> {formatDisplayValue(fm.incoterm)}</div>}
                        {fm.transit_time_from_trinidad_days && (
                          <div><span className="text-gray-500">{t("Tránsito TT:")}</span> {formatDisplayValue(fm.transit_time_from_trinidad_days)} días</div>
                        )}
                        {fm.payment_terms && (
                          <div><span className="text-gray-500">{t("Pago/Crédito:")}</span> {formatDisplayValue(fm.payment_terms)}</div>
                        )}
                        {fm.currency && (
                          <div><span className="text-gray-500">{t("Moneda:")}</span> {formatDisplayValue(fm.currency)}</div>
                        )}
                        {fm.annual_target_cases && (
                          <div className="col-span-2 text-sky-400">
                            <span className="text-gray-500">{t("Meta Anual:")}</span> {formatDisplayValue(fm.annual_target_cases)} cajas
                          </div>
                        )}
                        {fm.primary_ports && (
                          <div className="col-span-2 text-gray-300">
                            <span className="text-gray-500">{t("Puertos:")}</span> {Array.isArray(fm.primary_ports) ? fm.primary_ports.join(' · ') : formatDisplayValue(fm.primary_ports)}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Completeness Bar */}
                    {node.completeness_score !== undefined && (
                      <div className="mb-3">
                        <div className="flex justify-between text-[10px] text-gray-400 font-mono mb-1">
                          <span>{t("Nivel de Enriquecimiento")}</span>
                          <span>{node.completeness_score}%</span>
                        </div>
                        <div className="w-full bg-gray-800 h-1.5 rounded-full overflow-hidden">
                          <div
                            className="bg-gradient-to-r from-sky-500 to-emerald-400 h-full rounded-full transition-all duration-500"
                            style={{ width: `${node.completeness_score}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Formatted Dossier Body */}
                    <div className="mb-3 bg-gray-900/60 p-3 rounded-lg border border-gray-800/80">
                      {renderFormattedBody(node.type === 'person' ? (nodeBodies[node.id] ?? node.body ?? '').replace(/^#\s+[^\r\n]+/m, '# ' + humanNodeName(node)) : (nodeBodies[node.id] ?? node.body ?? ''), target => handleWikilinkClick(target, node.id), getWikilinkLabel)}
                    </div>



                    {/* Action Bar for Dots */}
                    <div className="mb-3 p-2 bg-sky-950/40 border border-sky-900 rounded-lg flex items-center justify-between text-xs">
                      <span className="text-sky-300 font-mono text-[11px]">Dots Agent Ready</span>
                      <button
                        onClick={() => {
                          setStatusMessage(`Petición enviada a Dots para enriquecer "${node.title}"`);
                          setTimeout(() => setStatusMessage(null), 3000);
                        }}
                        className="px-2.5 py-1 bg-sky-700 hover:bg-sky-600 text-white rounded text-[11px] font-semibold transition"
                      >
                        {t("Completar con Dots")}
                      </button>
                    </div>

                    {/* Wikilinks: Multi-Abrir */}
                    {node.links.length > 0 && (
                      <div className="pt-2 border-t border-gray-800">
                        <div className="text-[10px] uppercase font-bold text-gray-400 mb-1.5">
                          {t("Sinapsis Directas (Clic para Multi-Abrir):")}
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {node.links.map((linkName: any, i: number) => (
                            <button
                              key={i}
                              onClick={() => handleWikilinkClick(linkName, node.id)}
                              title={linkName}
                              data-canonical-target={linkName}
                              className="text-[11px] font-mono px-2 py-0.5 rounded bg-sky-950/70 border border-sky-800 text-sky-300 hover:bg-sky-900 hover:text-white transition"
                            >
                              {getWikilinkLabel(linkName)}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Mobile Sticky Thumb Action Bar at Bottom of Sheet (Min 44px touch target) */}
            <div className="md:hidden p-3 bg-gray-950/95 border-t border-gray-800 sticky bottom-0 z-10 flex gap-2 shrink-0">
              <button
                onClick={() => setStackedDeck([])}
                className="w-full py-3 bg-gray-800 hover:bg-red-950 active:scale-95 text-white rounded-xl text-xs font-bold border border-gray-700 hover:border-red-700 shadow flex items-center justify-center gap-2 min-h-[44px] transition"
                aria-label={t("Cerrar ficha ejecutiva")}
              >
                <span>✕</span>
                <span>{t("Cerrar Ficha Ejecutiva")}</span>
              </button>
            </div>
          </aside>
        </>
      )}
    </>
  );
}
