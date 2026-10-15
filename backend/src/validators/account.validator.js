export function validateAccountInput(data) {
  const { name, type } = data;
  if (!name || !String(name).trim()) return 'Account name is required.';
  const allowed = ['CASH', 'BANK', 'MOBILE_BANKING'];
  if (!type || !allowed.includes(type)) {
    return `Invalid account type. Allowed: ${allowed.join(', ')}`;
  }
  return null;
}
