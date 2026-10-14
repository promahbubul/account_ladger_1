import express from 'express';
import cors from 'cors';
import { apiRouter } from './routes/index.js';
import { errorHandler } from './middleware/error-handler.js';

export const createApp = () => {
  const app = express();

  app.use(cors());
  app.use(express.json());

  // Mount API router
  app.use('/api', apiRouter);

  // Global Centralized Error Handling
  app.use(errorHandler);

  return app;
};
