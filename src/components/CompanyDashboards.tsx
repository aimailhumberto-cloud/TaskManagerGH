'use client';
import { useState } from 'react';
import type { Task, Company } from '@/services/mockData';
import type { Project } from '@/lib/projects';
import { projectProgress } from '@/lib/projects';
import { getCompanyMeta } from '@/lib/hbCompanies';
import WorkspaceIcon from './WorkspaceIcon';
import type { WorkspaceCommand } from './TaskMaster';

export default function CompanyDashboards({
  tasks,
  companies,
  projects,
  selected,
  choose,
  busy = false,
  command,
}: {
  tasks: Task[];
  companies: Company[];
  projects: Project[];
  selected: string;
  choose: (id: string) => void;
  busy?: boolean;
  command?: WorkspaceCommand;
}) {
  const [manageOpen, setManageOpen] = useState(false);
  const [newName, setNewName] = useState('');

  return (
    <section className="tm-business-dashboards-v2" aria-label="Resumen ejecutivo de empresas">
      <div className="tm-heading">
        <div>
          <span className="tm-eyebrow">PORTAFOLIO EMPRESARIAL HB</span>
          <h2>Tus Empresas y Unidades de Negocio</h2>
        </div>
        <div className="tm-toolbar">
          {selected && (
            <button type="button" className="tm-soft-button" onClick={() => choose('')}>
              Ver todas las empresas ({companies.length})
            </button>
          )}
          {command && (
            <button
              type="button"
              className="tm-gold-button"
              onClick={() => setManageOpen(v => !v)}
            >
              ⚙️ {manageOpen ? 'Cerrar Editor de Empresas' : 'Gestionar Mis Empresas'}
            </button>
          )}
        </div>
      </div>

      {manageOpen && command && (
        <div className="tm-pane tm-pane-stone tm-company-manager">
          <div className="tm-heading">
            <h3>⚙️ Administrar Mis Empresas (Crear, Renombrar o Quitar)</h3>
            <span className="tm-small">IA para Todos vive anidado como sub-marca dentro de Bee Smart</span>
          </div>
          <form
            className="tm-inline-form"
            onSubmit={async e => {
              e.preventDefault();
              if (!newName.trim()) return;
              if (await command('createCompany', { name: newName.trim() }, 'Nueva empresa creada por HB')) {
                setNewName('');
              }
            }}
          >
            <input
              placeholder="Nombre de nueva empresa (ej. Nueva Unidad)…"
              value={newName}
              onChange={e => setNewName(e.target.value)}
              required
            />
            <button className="tm-gold-button" disabled={busy}>
              + Agregar Empresa
            </button>
          </form>
          <div className="tm-company-manager-list">
            {companies.map(c => {
              const meta = getCompanyMeta(c.id, c.name);
              return (
                <div key={c.id} className="tm-company-manager-row">
                  <span>
                    <strong>
                      {meta.icon} {c.name}
                    </strong>{' '}
                    <small>({meta.subBrands.join(' · ') || 'Unidad activa'})</small>
                  </span>
                  <div className="tm-inline-actions">
                    <button
                      type="button"
                      className="tm-soft-button"
                      disabled={busy}
                      onClick={async () => {
                        const next = window.prompt('Nuevo nombre para la empresa:', c.name);
                        if (next && next.trim() && next.trim() !== c.name) {
                          await command('updateCompany', { name: next.trim() }, 'Renombrada por HB', c.id, 1);
                        }
                      }}
                    >
                      ✏️ Renombrar
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="tm-business-dashboards">
        {companies
          .filter(c => !selected || c.id === selected)
          .map(c => {
            const meta = getCompanyMeta(c.id, c.name);
            const work = tasks.filter(
              t => t.companyId === c.id && !t.cancelledAt && t.validationStatus !== 'NeedsConfirmation'
            );
            const done = work.filter(t => t.status === 'Completed').length;
            const inProgress = work.filter(t => t.status === 'In Progress').length;
            const waiting = work.filter(
              t => t.status !== 'Completed' && (t.status === 'Blocked' || t.waitingOn)
            ).length;
            const pct = work.length ? Math.round(((done + inProgress * 0.5) / work.length) * 100) : 100;
            const doneDeg = Math.round((pct / 100) * 360);
            const ringStyle = {
              background: `conic-gradient(${meta.color} 0deg ${doneDeg}deg, rgba(255,255,255,0.12) ${doneDeg}deg 360deg)`,
            };
            const results = projects
              .filter(p => p.companyId === c.id && p.state !== 'Cancelled')
              .map(projectProgress);
            const accepted = results.reduce((n, p) => n + p.accepted, 0);
            const total = results.reduce((n, p) => n + p.total, 0);

            // Dynamic sub-categories from tasks + canonical sub-brands
            const taskSubBrands = Array.from(
              new Set(
                work
                  .flatMap(t => [t.category, ...(t.subcategories || [])])
                  .filter((v): v is string => !!v && v.trim().length > 0)
              )
            );
            const pills = Array.from(new Set([...meta.subBrands, ...taskSubBrands])).slice(0, 4);

            return (
              <article
                className={`tm-pane tm-pane-dark tm-company-card-v2 ${selected === c.id ? 'is-selected' : ''}`}
                key={c.id}
                onClick={() => choose(c.id)}
              >
                <div className="tm-company-card-top">
                  <div>
                    <button
                      type="button"
                      className="tm-heading-icon"
                      onClick={e => {
                        e.stopPropagation();
                        choose(c.id);
                      }}
                    >
                      <span className="tm-company-emoji" aria-hidden="true">
                        {meta.icon}
                      </span>
                      <h2>{c.name}</h2>
                    </button>
                    <p className="tm-small">{meta.subtitle}</p>
                  </div>
                  <div
                    className="tm-donut-ring tm-donut-sm"
                    style={ringStyle}
                    data-label={work.length ? `${pct}%` : 'Al día'}
                  />
                </div>

                {!!pills.length && (
                  <div className="tm-subbrand-pills" aria-label={`Sub-marcas y proyectos de ${c.name}`}>
                    {pills.map(pill => (
                      <span
                        key={pill}
                        className={`tm-subbrand-pill ${pill === 'IA para Todos' ? 'is-highlight' : ''}`}
                      >
                        📂 {pill}
                      </span>
                    ))}
                  </div>
                )}

                <div className="tm-business-metrics">
                  <span>
                    <b>{work.length - done}</b>Activas
                  </span>
                  <span>
                    <b>{done}</b>Completadas
                  </span>
                  <span>
                    <b>{waiting}</b>En espera
                  </span>
                </div>

                <progress aria-label={`Tareas completadas de ${c.name}`} value={done} max={work.length || 1} />
                <div className="tm-company-card-foot">
                  <span className="tm-small">
                    {c.id === 'business-sm-jaleel'
                      ? `Contrato 301,430 cases · ${work.length} tareas`
                      : `${done}/${work.length} tareas cerradas${total > 0 ? ` · ${accepted}/${total} entregables` : ''}`}
                  </span>
                  <span className="tm-gold-link">
                    Ver tareas abajo <WorkspaceIcon name="arrow" size={14} />
                  </span>
                </div>
              </article>
            );
          })}
      </div>
    </section>
  );
}
