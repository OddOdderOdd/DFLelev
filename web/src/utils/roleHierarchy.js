export const SYSTEM_ROLE_PRIORITY = {
  Owner: 5,
  Admin: 4,
  Forperson: 3,
  'Næstforperson': 2,
  Medlem: 1,
};

export function normaliserRolle(rolle = '') {
  if (rolle === 'Owner' || rolle === 'Admin') return rolle;
  const lower = rolle.toLowerCase();
  if (lower.includes('næst') || lower.includes('naest')) return 'Næstforperson';
  if (lower.includes('forperson') || lower.includes('chair')) return 'Forperson';
  return 'Medlem';
}

export function rolleNiveau(rolle = '') {
  const key = normaliserRolle(rolle);
  return SYSTEM_ROLE_PRIORITY[key] || 0;
}

export function hoejesteRolleNiveau(myndigheder = []) {
  return Math.max(0, ...(myndigheder || []).map(m => rolleNiveau(m.rolle)));
}
