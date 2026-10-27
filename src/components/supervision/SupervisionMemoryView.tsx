'use client';

import React from 'react';
import type { V1Object, V1DocumentData } from '@/lib/supervision/types';

function formatDate(iso: string | null): string {
  if (!iso) return 'Sin fecha';
  try {
    return new Date(iso).toLocaleString('es', {
      timeZone: 'America/Panama',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export default function SupervisionMemoryView({
  objects,
  allowContent,
  onToggleContent,
}: {
  objects: V1Object[];
  allowContent: boolean;
  onToggleContent: () => void;
}) {
  const documents = objects.filter(o => o.kind === 'document');

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-700/60 pb-3">
        <div>
          <h3 className="text-lg font-bold text-slate-100">Memoria Documental y Registro de Metadatos</h3>
          <p className="text-xs text-slate-400">
            Espejo privado de metadatos, control de conflictos y separación estricta de contenidos.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-slate-300 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700 cursor-pointer hover:bg-slate-700/60 transition">
            <input
              type="checkbox"
              checked={allowContent}
              onChange={onToggleContent}
              className="rounded bg-slate-900 border-slate-700 text-teal-500 focus:ring-0"
            />
            <span>Permiso simulado: <code>document_content</code></span>
          </label>
        </div>
      </div>

      <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-lg text-xs text-slate-400 space-y-1">
        <p>
          🔒 <strong>Seguridad y gobierno:</strong> ChatGPT y la conversación directa permanecen como base principal de decisiones.
          Una edición de documento o contenido externo <em>nunca</em> se convierte automáticamente en instrucción o autorización.
        </p>
        <p>
          👁️ <strong>Separación de permisos:</strong> Los metadatos de documentos están disponibles en consulta normal. El cuerpo del texto está protegido y requiere el permiso independiente <code>document_content</code>.
        </p>
      </div>

      {documents.length === 0 ? (
        <div className="spv-card text-center py-8 text-slate-400 text-sm">
          No hay documentos registrados en el scope seleccionado.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {documents.map(doc => {
            const data = doc.data as V1DocumentData;
            const hasConflict = data.conflict;

            return (
              <article
                key={doc.id}
                className={`spv-card border-l-4 ${
                  hasConflict ? 'border-l-rose-500 bg-rose-950/10' : 'border-l-cyan-500'
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-800 pb-2 mb-3">
                  <div>
                    <span className="text-[11px] font-mono text-slate-400 block">{doc.id}</span>
                    <h4 className="text-base font-bold text-slate-100">{data.title}</h4>
                  </div>
                  <div className="flex items-center gap-2">
                    {hasConflict && (
                      <span className="spv-dimension-pill spv-pill-alert">
                        ⚠️ Conflicto Activo
                      </span>
                    )}
                    <span className="text-xs text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                      rev {doc.revision}
                    </span>
                  </div>
                </div>

                {hasConflict && (
                  <div className="p-3 mb-3 bg-rose-950/30 border border-rose-800/40 rounded-lg text-xs text-rose-200">
                    <strong>Alerta de Conflicto Documental:</strong> Se ha detectado una discrepancia entre fuentes o versiones.
                    El contrato v1 mantiene el conflicto visible sin resolver ni sincronizar automáticamente. Requiere intervención manual.
                  </div>
                )}

                {/* Metadatos */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs bg-slate-900/60 p-3 rounded-lg border border-slate-800 mb-3">
                  <div>
                    <span className="text-slate-400 block font-medium">Capturado:</span>
                    <span className="text-slate-200">{formatDate(data.captured_at)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Disponibilidad:</span>
                    <span className="text-slate-200">{data.availability}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Adjuntos:</span>
                    <span className="text-slate-200">
                      {data.attachments.length > 0 ? data.attachments.join(', ') : 'Ninguno'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block font-medium">Hash Verificador:</span>
                    <span className="font-mono text-[10px] text-slate-300 truncate block">
                      {data.hash}
                    </span>
                  </div>
                </div>

                {/* Contenido (con separación de permisos) */}
                <div className="mt-3">
                  <span className="text-xs font-semibold text-slate-300 block mb-1">
                    Cuerpo del Documento:
                  </span>
                  {allowContent && data.content ? (
                    <div className="bg-slate-950/80 p-3 rounded border border-slate-800 text-xs text-slate-200 font-sans whitespace-pre-wrap">
                      {data.content}
                    </div>
                  ) : (
                    <div className="bg-slate-950/40 p-3 rounded border border-slate-800/60 text-xs text-slate-500 italic flex items-center justify-between">
                      <span>[Contenido privado no disponible sin permiso document_content]</span>
                      <button
                        onClick={onToggleContent}
                        className="text-xs text-teal-400 hover:underline not-italic font-sans"
                      >
                        Activar permiso simulado
                      </button>
                    </div>
                  )}
                </div>

                {/* Historial de Revisiones Documentales Conservadas */}
                {doc.revisions_history && doc.revisions_history.length > 0 && (
                  <details className="mt-3 text-xs bg-slate-950/60 p-2.5 rounded border border-slate-800">
                    <summary className="cursor-pointer text-slate-400 hover:text-slate-200 font-medium">
                      📜 Revisiones históricas conservadas ({doc.revisions_history.length} previas registradas)
                    </summary>
                    <div className="mt-2 space-y-1.5 pl-2 border-l-2 border-slate-700">
                      {doc.revisions_history.map((prev, idx) => {
                        const pData = prev.data as V1DocumentData;
                        return (
                          <div key={idx} className="text-slate-400">
                            <span className="font-semibold text-slate-200">Rev {prev.revision}:</span>{' '}
                            {pData.title} · hash: <code>{pData.hash.slice(0, 18)}…</code> (capturado:{' '}
                            {pData.captured_at ? formatDate(pData.captured_at) : 'sin fecha'})
                          </div>
                        );
                      })}
                    </div>
                  </details>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
