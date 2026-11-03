/**
 * Format number as currency (BDT or custom)
 */
export const formatCurrency = (amount, currency = 'BDT') => {
  const num = Number(amount) || 0;
  const isNegative = num < 0;
  const absNum = Math.abs(num);

  const formatted = absNum.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const symbol = currency === 'BDT' ? '৳' : currency === 'USD' ? '$' : currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : `${currency} `;
  return `${isNegative ? '-' : ''}${symbol}${formatted}`;
};

/**
 * Format any date into standard DD/MM/YYYY
 */
export const formatDate = (dateInput) => {
  if (!dateInput) return '-';
  const str = String(dateInput).trim();
  if (!str) return '-';

  if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) {
    return str;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [y, m, d] = str.split('-');
    return `${d}/${m}/${y}`;
  }

  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }

  return str;
};

/**
 * Get today's date formatted as YYYY-MM-DD
 */
export const getTodayISO = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

/**
 * Convert DD/MM/YYYY to YYYY-MM-DD
 */
export const toISODate = (displayDate) => {
  if (!displayDate) return getTodayISO();
  const trimmed = String(displayDate).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(trimmed)) {
    const [d, m, y] = trimmed.split('/');
    return `${y}-${m}-${d}`;
  }
  return trimmed.slice(0, 10);
};

// Returns the amount as a number, or null if the text is not a clean positive amount.
// Accepts grouped input such as 1,500 and 1,00,000, which parseFloat would truncate to 1.
export const parseAmount = (input) => {
  const text = String(input ?? '').trim();
  const isPlain = /^\d+(\.\d{0,2})?$|^\.\d{1,2}$/.test(text);
  const isGrouped = /^\d{1,3}(,\d{2,3})+(\.\d{0,2})?$/.test(text);
  if (!isPlain && !isGrouped) return null;
  const value = Number(text.replace(/,/g, ''));
  return value > 0 ? value : null;
};

export const isValidISODate = (input) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(input ?? ''));
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  return d.getUTCFullYear() === year && d.getUTCMonth() === month - 1 && d.getUTCDate() === day;
};
