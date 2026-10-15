export const logger = {
  info: (...args) => console.log('[HisabFlow API]', ...args),
  warn: (...args) => console.warn('[HisabFlow API Warning]', ...args),
  error: (...args) => console.error('[HisabFlow API Error]', ...args),
  debug: (...args) => {
    if (process.env.NODE_ENV !== 'production') {
      console.log('[HisabFlow API Debug]', ...args);
    }
  },
};
