import { dbService } from '@/services/dbService';

export async function resolveOrCreateCompany(rawComp?: any): Promise<string> {
  const existingCompanies = await dbService.getCompanies();
  const fallbackId = existingCompanies[0]?.id || 'comp-1';
  
  if (rawComp === undefined || rawComp === null) return fallbackId;
  
  let val = '';
  if (typeof rawComp === 'object') {
    val = rawComp.id || rawComp.name || '';
  } else {
    val = String(rawComp);
  }
  
  const trimmed = val.trim();
  if (trimmed === '') return fallbackId;

  // Try finding by exact ID first
  const byId = existingCompanies.find(c => c.id === trimmed);
  if (byId) {
    return byId.id;
  }
  // Try finding by name (case-insensitive)
  const byName = existingCompanies.find(c => c.name.toLowerCase() === trimmed.toLowerCase());
  if (byName) {
    return byName.id;
  }
  // Create a new company dynamically
  const newComp = await dbService.createCompany({ name: trimmed });
  return newComp.id;
}

export async function resolveOrCreateAssignee(rawAssignee?: any): Promise<string> {
  if (rawAssignee === undefined || rawAssignee === null) return '';
  
  let val = '';
  if (typeof rawAssignee === 'object') {
    val = rawAssignee.id || rawAssignee.name || '';
  } else {
    val = String(rawAssignee);
  }
  
  const trimmed = val.trim();
  if (trimmed === '' || trimmed.toLowerCase() === 'unassigned') return '';

  const existingPeople = await dbService.getPeople();
  // Try finding by exact ID first
  const byId = existingPeople.find(p => p.id === trimmed);
  if (byId) {
    return byId.id;
  }
  // Try finding by name (case-insensitive)
  const byName = existingPeople.find(p => p.name.toLowerCase() === trimmed.toLowerCase());
  if (byName) {
    return byName.id;
  }
  // Create a new person dynamically
  const newPerson = await dbService.createPerson({
    name: trimmed,
    role: 'Member',
    avatar: '/avatars/user.png'
  });
  return newPerson.id;
}
