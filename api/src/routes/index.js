import { Router } from 'express';

export const apiRouter = Router();

// Health check endpoint
apiRouter.get('/health', (req, res) => {
  res.json({
    status: 'success',
    data: {
      service: 'HisabFlow REST API',
      status: 'healthy',
      timestamp: new Date().toISOString(),
      phase: 'Phase 1 - Scaffold & Blueprint'
    }
  });
});

// Route modules (scaffolded routes for future phases)
apiRouter.get('/accounts', (req, res) => res.json({ status: 'success', message: 'Accounts endpoint scaffolded' }));
apiRouter.get('/categories', (req, res) => res.json({ status: 'success', message: 'Categories endpoint scaffolded' }));
apiRouter.get('/income', (req, res) => res.json({ status: 'success', message: 'Income endpoint scaffolded' }));
apiRouter.get('/expenses', (req, res) => res.json({ status: 'success', message: 'Expenses endpoint scaffolded' }));
apiRouter.get('/transfers', (req, res) => res.json({ status: 'success', message: 'Transfers endpoint scaffolded' }));
apiRouter.get('/loans', (req, res) => res.json({ status: 'success', message: 'Loans endpoint scaffolded' }));
apiRouter.get('/transactions', (req, res) => res.json({ status: 'success', message: 'Transactions endpoint scaffolded' }));
apiRouter.get('/reports/summary', (req, res) => res.json({ status: 'success', message: 'Reports summary endpoint scaffolded' }));
