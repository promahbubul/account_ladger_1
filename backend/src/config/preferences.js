export const SUPPORTED_CURRENCIES = ['BDT', 'USD', 'EUR', 'GBP', 'INR', 'SAR', 'AED', 'CAD', 'JPY'];

export const SUPPORTED_DATE_FORMATS = ['DD MMM YYYY', 'DD/MM/YYYY', 'MM/DD/YYYY', 'YYYY-MM-DD'];

export function isValidTimezone(timezone) {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}
