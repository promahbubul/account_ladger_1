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
