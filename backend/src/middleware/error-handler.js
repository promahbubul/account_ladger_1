import { logger } from '../utils/logger.js';
import { config } from '../config/env.js';

export const errorHandler = (err, req, res, next) => {
  const statusCode = err.statusCode || (err.name === 'ValidationError' ? 400 : 500);
  const message = err.message || 'Internal Server Error';

  // Only server faults need a stack trace in the log.
  if (statusCode >= 500) logger.error(`${req.method} ${req.originalUrl || req.url}:`, err);
  else logger.warn(`${req.method} ${req.originalUrl || req.url}: ${statusCode} ${message}`);

  res.status(statusCode).json({
    status: 'error',
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message,
      ...(!config.isProduction && { stack: err.stack }),
    },
  });
};
