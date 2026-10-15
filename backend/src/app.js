import express from 'express';
import cors from 'cors';
import { apiRouter } from './routes/index.js';
import { errorHandler } from './middleware/error-handler.js';
import { config } from './config/env.js';
import { dbService } from './services/db.service.js';

export function createApp() {
  const app = express();

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
        if (allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
          return callback(null, true);
        }
        return callback(new Error(`CORS policy: origin ${origin} not allowed.`));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    })
  );

  app.use(express.json());

  // Root health check endpoint
  app.get('/health', (req, res) => {
    const status = dbService.getStatus();
    res.json({
      status: 'healthy',
      service: 'HisabFlow REST API',
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
