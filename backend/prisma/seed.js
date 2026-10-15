import { dbService } from '../src/services/db.service.js';
import { logger } from '../src/utils/logger.js';

async function seed() {
  try {
    logger.info('Starting database seed script...');
    await dbService.initialize();
    logger.info('Database seed completed successfully.');
    process.exit(0);
  } catch (err) {
    logger.error('Seed execution error:', err);
    process.exit(1);
  }
}

seed();
