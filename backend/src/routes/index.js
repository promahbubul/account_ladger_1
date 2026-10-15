import { Router } from 'express';
import { authRouter } from './auth.routes.js';
import { userRouter } from './user.routes.js';
import { adminRouter } from './admin.routes.js';
import { accountRouter } from './account.routes.js';
import { categoryRouter } from './category.routes.js';
import { transactionRouter } from './transaction.routes.js';
import { transferRouter } from './transfer.routes.js';
import { loanRouter } from './loan.routes.js';
import { budgetRouter } from './budget.routes.js';
import { reportRouter } from './report.routes.js';
import { dbService } from '../services/db.service.js';

export const apiRouter = Router();

// Health check endpoint
apiRouter.get('/health', (req, res) => {
  const status = dbService.getStatus();
  res.json({
    status: 'healthy',
    service: 'Account Ladger REST API',
    database: status.mode,
    connectedToPostgres: status.connectedToPostgres,
    timestamp: new Date().toISOString(),
  });
});

// Sub-routers
apiRouter.use('/auth', authRouter);
apiRouter.use('/user', userRouter);
apiRouter.use('/admin', adminRouter);
apiRouter.use('/accounts', accountRouter);
apiRouter.use('/categories', categoryRouter);
apiRouter.use('/transactions', transactionRouter);
apiRouter.use('/transfers', transferRouter);
apiRouter.use('/loans', loanRouter);
apiRouter.use('/budgets', budgetRouter);
apiRouter.use('/reports', reportRouter);
