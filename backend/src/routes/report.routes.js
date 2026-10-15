import { Router } from 'express';
import { getSummary, exportData } from '../controllers/report.controller.js';
import { authenticateToken, requireUserOnly } from '../middleware/auth.js';

export const reportRouter = Router();

reportRouter.use(authenticateToken, requireUserOnly);

reportRouter.get('/summary', getSummary);
reportRouter.get('/export', exportData);
