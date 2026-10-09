import type { Task } from '@/services/mockData';

export const SMJ_COMPANY_ID = 'business-sm-jaleel';
export const smjTabs = [
  ['summary', 'Resumen'], ['work', 'Trabajo'], ['agenda', 'Agenda'],
  ['distributors', 'Distribuidores'], ['indicators', 'Indicadores'],
  ['communications', 'Comunicaciones'], ['files', 'Archivos'],
] as const;
export type SmjTab = typeof smjTabs[number][0];
export interface SmjFilters { market: string; area: string; period: string }
export const smjReference = {
  sourceUrl: 'https://docs.google.com/spreadsheets/d/1BMKGa2UTxMhgMC-Pob7CwCSBQqfiia-Y/edit',
  sourceName: 'SMJ_HB_Targets_and_Contract_v2.xlsx · versión de Library 3',
  reviewedAt: '2026-10-09',
  period: 'Noviembre de 2026 a abril de 2027',
  total: 301430, canada: 163726, usa: 137704,
  contractualTemplates: 23, supportingControls: 3, scorecardCriteria: 14,
};
export const smjPeriods = ['2026-11', '2026-12', '2027-01', '2027-02', '2027-03', '2027-04'];
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('es');
export function validSmjTab(value: string | null): value is SmjTab {
  return smjTabs.some(([id]) => id === value);
}
export function smjTasks(tasks: Task[], filters: SmjFilters): Task[] {
  return tasks.filter(task => task.companyId === SMJ_COMPANY_ID && !task.cancelledAt
    && (!filters.area || (filters.area === '__unclassified' ? !task.category : task.category === filters.area))
    && (!filters.period || (task.workDate || task.dueDate || '').slice(0, 7) === filters.period)
    && (!filters.market || (task.subcategories || []).some(tag => {
      const label = normalize(tag);
      return filters.market === 'Canada' ? ['canada', 'ca'].includes(label)
        : ['usa', 'us', 'eeuu', 'estados unidos', 'united states'].includes(label);
    })));
}
export function safeSourceUrl(value?: string): string | null {
  try { const url = new URL(value || ''); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : null; }
  catch { return null; }
}
export function smjTaskSources(tasks: Task[]) {
  const sources = new Map<string, Task[]>();
  for (const task of tasks.filter(t => t.companyId === SMJ_COMPANY_ID)) {
    const url = safeSourceUrl(task.sourceUrl);
    if (url) sources.set(url, [...(sources.get(url) || []), task]);
  }
  return [...sources].map(([url, linkedTasks]) => ({ url, tasks: linkedTasks }));
}
export function attachmentLink(filepath: string): string | null {
  const match = filepath.match(/^\/data\/attachments\/([^/\\?#]+)$/);
  if (!match) return null;
  try { const filename = decodeURIComponent(match[1]); return filename && !/[\/\\\x00-\x1f]/.test(filename) && !['.', '..'].includes(filename) ? '/data/attachments/' + encodeURIComponent(filename) : null; }
  catch { return null; }
}
