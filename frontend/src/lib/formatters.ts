// Formatting utilities for AccountLedger
// Default currency: BDT (৳ - Taka)

export const CURRENCY_SYMBOLS: Record<string, string> = {
  BDT: '৳',
  USD: '$',
  EUR: '€',
  GBP: '£',
  INR: '₹',
  SAR: '﷼',
  AED: 'د.إ',
  CAD: 'C$',
  JPY: '¥',
};

export const getCurrencySymbol = (currencyCode?: string): string => {
  if (currencyCode && CURRENCY_SYMBOLS[currencyCode]) {
    return CURRENCY_SYMBOLS[currencyCode];
  }
  try {
    const saved = localStorage.getItem('hisabflow_auth_user_v2');
    if (saved) {
      const u = JSON.parse(saved);
      if (u.currency && CURRENCY_SYMBOLS[u.currency]) {
        return CURRENCY_SYMBOLS[u.currency];
      }
      if (u.currency) return u.currency;
    }
  } catch {
    // ignore
  }
  return '৳';
};

export const formatBDT = (amount: number | null | undefined, showSign: boolean = false, customCurrency?: string): string => {
  // A missing value must not read as a real zero balance.
  if (amount === null || amount === undefined || Number.isNaN(amount)) return '—';

  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);
  
  // Format with standard comma separator
  const formattedNumber = absAmount.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const currencySymbol = getCurrencySymbol(customCurrency);

  if (showSign) {
    if (amount > 0) return `+${currencySymbol}${formattedNumber}`;
    if (amount < 0) return `-${currencySymbol}${formattedNumber}`;
  }

  return `${isNegative ? '-' : ''}${currencySymbol}${formattedNumber}`;
};

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const applyDateFormat = (d: string, m: string, y: string | number): string => {
  let format = 'DD MMM YYYY';
  try {
    format = JSON.parse(localStorage.getItem('hisabflow_auth_user_v2') || '{}').dateFormat || format;
  } catch {
    // ignore
  }
  switch (format) {
    case 'DD/MM/YYYY':
      return `${d}/${m}/${y}`;
    case 'MM/DD/YYYY':
      return `${m}/${d}/${y}`;
    case 'YYYY-MM-DD':
      return `${y}-${m}-${d}`;
    default:
      return `${d} ${MONTH_NAMES[Number(m) - 1]} ${y}`;
  }
};

export const formatDate = (dateInput?: string | Date | null): string => {
  if (!dateInput) return '-';
  const str = String(dateInput).trim();
  if (!str) return '-';

  // Already formatted as DD/MM/YYYY
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(str)) {
    const [d, m, y] = str.split('/');
    return applyDateFormat(d, m, y);
  }

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [y, m, d] = str.split('-');
    return applyDateFormat(d, m, y);
  }

  // Parse general Date / ISO string
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return applyDateFormat(day, month, year);
  }

  return str;
};

export const formatDateTime = (dateInput?: string | Date | null): string => {
  if (!dateInput) return '-';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return String(dateInput);
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: true });
  return `${formatDate(d.toISOString())} ${time}`;
};

// Returns the amount as a number, or null if the text is not a clean positive amount.
// Accepts grouped input such as 1,500 and 1,00,000, which parseFloat would truncate to 1.
export const parseAmount = (input: string | number | null | undefined): number | null => {
  const text = String(input ?? '').trim();
  const isPlain = /^\d+(\.\d{0,2})?$|^\.\d{1,2}$/.test(text);
  const isGrouped = /^\d{1,3}(,\d{2,3})+(\.\d{0,2})?$/.test(text);
  if (!isPlain && !isGrouped) return null;
  const value = Number(text.replace(/,/g, ''));
  return value > 0 ? value : null;
};
