export function validateTransactionInput(data) {
  const { accountId, amount, date, description } = data;
  if (!accountId) return 'Account is required.';
  if (amount === undefined || isNaN(Number(amount)) || Number(amount) <= 0) {
    return 'Amount must be a positive number.';
  }
  if (!date || isNaN(Date.parse(date))) return 'Valid date is required.';
  if (!description || !String(description).trim()) return 'Description is required.';
  return null;
}
