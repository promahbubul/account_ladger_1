import { Router } from 'express';
import { getBudgets, setBudget, deleteBudget } from '../controllers/budget.controller.js';
import { authenticateToken, requireUserOnly } from '../middleware/auth.js';

export const budgetRouter = Router();

budgetRouter.use(authenticateToken, requireUserOnly);

budgetRouter.get('/', getBudgets);
budgetRouter.post('/', setBudget);
budgetRouter.delete('/:categoryName', deleteBudget);
