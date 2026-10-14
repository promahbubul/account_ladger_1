// Formatting utilities for HisabFlow
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

export const formatBDT = (amount: number, showSign: boolean = false, customCurrency?: string): string => {
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

export const formatDate = (dateString: string): string => {
  return dateString;
};

