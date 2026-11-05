import express from 'express';
import cors from 'cors';
import { apiRouter } from './routes/index.js';
import { errorHandler } from './middleware/error-handler.js';
import { compressJson } from './middleware/compress-json.js';
import { config } from './config/env.js';
import { dbService } from './services/db.service.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', config.trustProxy);
  app.disable('x-powered-by');

  // This API only serves JSON, so these are all the browser-facing protections it needs.
  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
    if (config.isProduction) {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
  });

  // CORS Configuration: allow frontend origin
  const allowedOrigins = [
    config.frontendUrl,
    'http://localhost:5000',
    'http://127.0.0.1:5000',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ].filter(Boolean);

  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
        if (!origin) return callback(null, true);
        if (allowedOrigins.includes(origin) || !config.isProduction) {
          return callback(null, true);
        }
        return callback(Object.assign(new Error(`CORS policy: origin ${origin} not allowed.`), { statusCode: 403, code: 'CORS_ORIGIN_NOT_ALLOWED' }));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    })
  );

  app.use(compressJson);
  app.use(express.json({ limit: '5mb' }));

  // Root health check endpoint
  app.get('/health', async (req, res) => {
    const status = dbService.getStatus();
    const healthy = await dbService.isDatabaseHealthy();
    res.status(healthy ? 200 : 503).json({
      status: healthy ? 'healthy' : 'unhealthy',
      service: 'AccountLedger REST API',
      database: status.mode,
      connectedToPostgres: status.connectedToPostgres,
      timestamp: new Date().toISOString(),
    });
  });

  // Mount API router
  app.use('/api', apiRouter);

  // Centralized Error Handling
  app.use(errorHandler);

  return app;
}

export const app = createApp();
