import { Router } from 'express';
import { getTransfers, createTransfer, deleteTransfer } from '../controllers/transfer.controller.js';
import { authenticateToken, requireUserOnly } from '../middleware/auth.js';

export const transferRouter = Router();

transferRouter.use(authenticateToken, requireUserOnly);

transferRouter.get('/', getTransfers);
transferRouter.post('/', createTransfer);
transferRouter.delete('/:id', deleteTransfer);
