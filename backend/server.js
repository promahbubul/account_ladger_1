import { createApp } from './src/app.js';
import { dbService } from './src/services/db.service.js';
import { config } from './src/config/env.js';
import { logger } from './src/utils/logger.js';

async function start() {
  try {
    // 1. Initialize Database connection & seed state
    logger.info('Initializing AccountLedger.com Database...');
    await dbService.initialize();

    // 2. Create Express application
    const app = createApp();

    // 3. Start HTTP Server
    const PORT = config.port;
    const server = app.listen(PORT, '0.0.0.0', () => {
      logger.info(`Server running on http://localhost:${PORT} in ${config.nodeEnv} mode`);
      logger.info(`Allowed frontend URL: ${config.frontendUrl}`);
      logger.info(`API Health endpoint: http://localhost:${PORT}/health`);
    });

    // Handle termination signals
    const shutdown = () => {
      logger.info('Shutting down gracefully...');
      server.close(() => {
        logger.info('Server closed.');
        process.exit(0);
      });
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  } catch (err) {
    logger.error('Fatal startup error:', err);
    process.exit(1);
  }
}

start();
