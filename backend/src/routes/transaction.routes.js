import { Router } from 'express';
import {
  getTransactions,
  createIncome,
  createExpense,
  createBulkExpense,
  updateTransaction,
  deleteTransaction,
} from '../controllers/transaction.controller.js';
import { authenticateToken, requireUserOnly } from '../middleware/auth.js';

export const transactionRouter = Router();

transactionRouter.use(authenticateToken, requireUserOnly);

transactionRouter.get('/', getTransactions);
transactionRouter.post('/income', createIncome);
transactionRouter.post('/expense', createExpense);
transactionRouter.post('/bulk', createBulkExpense);
transactionRouter.put('/:id', updateTransaction);
transactionRouter.delete('/:id', deleteTransaction);
