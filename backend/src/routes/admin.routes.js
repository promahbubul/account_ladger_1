import { Router } from 'express';
import {
  getUsers,
  createUser,
  updateUser,
  toggleUserStatus,
  resetUserPassword,
  deleteUser,
  getStats,
  getDbStatus,
  getAuditLogs,
  getSettings,
  updateSettings,
} from '../controllers/admin.controller.js';
import { authenticateToken, requireAdmin } from '../middleware/auth.js';

export const adminRouter = Router();

// Protect all admin routes
adminRouter.use(authenticateToken, requireAdmin);

adminRouter.get('/users', getUsers);
adminRouter.post('/users', createUser);
adminRouter.put('/users/:id', updateUser);
adminRouter.patch('/users/:id/status', toggleUserStatus);
adminRouter.patch('/users/:id/toggle-active', toggleUserStatus);
adminRouter.post('/users/:id/reset-password', resetUserPassword);
adminRouter.delete('/users/:id', deleteUser);

adminRouter.get('/stats', getStats);
adminRouter.get('/db-status', getDbStatus);
adminRouter.get('/audit-logs', getAuditLogs);
adminRouter.get('/settings', getSettings);
adminRouter.put('/settings', updateSettings);
