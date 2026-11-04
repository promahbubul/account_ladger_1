import { Router } from 'express';
import { getSummary, getAnalytics, exportData } from '../controllers/report.controller.js';
import { authenticateToken, requireUserOnly } from '../middleware/auth.js';

export const reportRouter = Router();

reportRouter.use(authenticateToken, requireUserOnly);

reportRouter.get('/summary', getSummary);
reportRouter.get('/analytics', getAnalytics);
reportRouter.get('/export', exportData);
