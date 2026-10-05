import type { Person, DatabaseSchema } from '@/services/mockData';
export const lumen: Person = { id: 'agent-lumen', name: 'lumen', role: 'AIAgent', avatar: '' };
export function responsiblePeople(data: Pick<DatabaseSchema, 'people'>): Person[] { return data.people.some(p => p.id === lumen.id) ? data.people : [...data.people, lumen]; }
export interface AutomationSnapshot { id: string; ownerId: string; title: string; purpose: string; companyId: string; assigneeId: string; provider: 'ChatGPT' | 'Other'; externalId: string; sourceUrl: string; configuration: 'Unknown' | 'Enabled' | 'Disabled'; verifiedAt: string; evidence: string; lastRunAt: string; lastOutcome: 'Unknown' | 'Succeeded' | 'Failed'; outcomeEvidence: string; nextRunAt: string; blockedBy: string; revision: number }
export interface AutomationRecord extends AutomationSnapshot { history: { at: string; actorId: string; reason: string; snapshot: AutomationSnapshot; provenance?: import('@/services/mockData').LogEntry['provenance'] }[] }
export interface MarinePoint { label: string; latitude: string; longitude: string }
export interface HeroSnapshot { id: string; ownerId: string; revision: number; background: 'Lake' | 'Warm' | 'Plain' | 'Custom'; image: string; locationLabel: string; latitude: string; longitude: string; widgetsEnabled: boolean; homeMarine?: MarinePoint | null }
export interface HeroPreference extends HeroSnapshot { history: { at: string; actorId: string; reason: string; snapshot: HeroSnapshot; provenance?: import('@/services/mockData').LogEntry['provenance'] }[] }
