export const SYSTEM_ROLE_PRIORITY = {
  Owner: 3,
  Admin: 2,
  Rolle: 1,
};

export function normaliserRolle(rolle = '') {
  if (rolle === 'Owner' || rolle === 'Admin') return rolle;
  return 'Rolle';
}

export function rolleNiveau(rolle = '') {
  const key = normaliserRolle(rolle);
  return SYSTEM_ROLE_PRIORITY[key] || 0;
}

export function hoejesteRolleNiveau(myndigheder = []) {
  return Math.max(0, ...(myndigheder || []).map(m => rolleNiveau(m.rolle)));
}
