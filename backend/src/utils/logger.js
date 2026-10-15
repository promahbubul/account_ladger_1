export const logger = {
  info: (...args) => console.log('[AccountLedger.com API]', ...args),
  warn: (...args) => console.warn('[AccountLedger.com API Warning]', ...args),
  error: (...args) => console.error('[AccountLedger.com API Error]', ...args),
  debug: (...args) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log('[AccountLedger.com API Debug]', ...args);
    }
  },
};
