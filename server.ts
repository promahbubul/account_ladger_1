import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { dbService } from './server/db.js';
import { apiRouter } from './server/apiRouter.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();

  // Parse command line arguments for port (e.g., npm run dev --port 3000 --host 0.0.0.0)
  const portIndex = process.argv.indexOf('--port');
  const cliPort = portIndex !== -1 ? parseInt(process.argv[portIndex + 1], 10) : undefined;
  const PORT = Number(process.env.PORT) || cliPort || 3000;

  app.use(express.json());

  // Initialize database (Neon PostgreSQL if configured, or local persistent store)
  await dbService.initialize();

  // Mount API router
  app.use('/api', apiRouter);

  // Health check endpoint
  app.get('/health', (req, res) => {
    const status = dbService.getStatus();
    res.json({
      status: 'healthy',
      service: 'HisabFlow Production API',
      database: status.mode,
      connectedToNeon: status.connectedToNeon,
      timestamp: new Date().toISOString(),
    });
  });

  const isProduction = process.env.NODE_ENV === 'production';

  if (!isProduction) {
    // Vite middleware for development
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        host: '0.0.0.0',
        port: PORT,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Static file serving for production
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[HisabFlow Server] Running on http://0.0.0.0:${PORT} in ${isProduction ? 'production' : 'development'} mode`);
  });
}

startServer().catch((err) => {
  console.error('[HisabFlow Server] Fatal startup error:', err);
  process.exit(1);
});
