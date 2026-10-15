import { Router } from 'express';
import {
  getLoans,
  getRepayments,
  createLoan,
  deleteLoan,
  addRepayment,
} from '../controllers/loan.controller.js';
import { authenticateToken, requireUserOnly } from '../middleware/auth.js';

export const loanRouter = Router();

loanRouter.use(authenticateToken, requireUserOnly);

loanRouter.get('/', getLoans);
loanRouter.get('/repayments', getRepayments);
loanRouter.post('/', createLoan);
loanRouter.delete('/:id', deleteLoan);
loanRouter.post('/:id/repayments', addRepayment);
