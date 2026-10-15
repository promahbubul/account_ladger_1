import { Router } from 'express';
import {
  getAccounts,
  createAccount,
  updateAccount,
  archiveAccount,
  deleteAccount,
} from '../controllers/account.controller.js';
import { authenticateToken, requireUserOnly } from '../middleware/auth.js';

export const accountRouter = Router();

accountRouter.use(authenticateToken, requireUserOnly);

accountRouter.get('/', getAccounts);
accountRouter.post('/', createAccount);
accountRouter.put('/:id', updateAccount);
accountRouter.patch('/:id/archive', archiveAccount);
accountRouter.delete('/:id', deleteAccount);
