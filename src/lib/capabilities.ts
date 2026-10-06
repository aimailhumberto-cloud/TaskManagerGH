// Explicit compatibility with the verified original Owner role.
// Preserve stored roles and derive permissions from the current database profile.
export function hasAdministrationCapability(role: unknown): boolean {
  return role === 'Admin' || role === 'Owner';
}
