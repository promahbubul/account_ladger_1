import { dbService } from '../services/db.service.js';

export async function getSummary(req, res) {
  try {
    const userId = req.user.id;
    const accounts = await dbService.getAccounts(userId);
    const transactions = await dbService.getTransactions(userId);
    const loans = await dbService.getLoans(userId);

    const totalCash = accounts.filter((a) => a.type === 'CASH').reduce((sum, a) => sum + a.currentBalance, 0);
    const totalBank = accounts.filter((a) => a.type === 'BANK').reduce((sum, a) => sum + a.currentBalance, 0);
    const totalMobile = accounts.filter((a) => a.type === 'MOBILE_BANKING').reduce((sum, a) => sum + a.currentBalance, 0);
    const netWorth = accounts.reduce((sum, a) => sum + a.currentBalance, 0);

    const totalIncome = transactions.filter((t) => t.type === 'INCOME').reduce((sum, t) => sum + t.amount, 0);
    const totalExpense = transactions.filter((t) => t.type === 'EXPENSE').reduce((sum, t) => sum + t.amount, 0);
    const netSavings = totalIncome - totalExpense;

    const totalReceivables = loans.filter((l) => l.type === 'LENT').reduce((sum, l) => sum + l.outstandingPrincipal, 0);
    const totalPayables = loans.filter((l) => l.type === 'BORROWED').reduce((sum, l) => sum + l.outstandingPrincipal, 0);

    res.json({
      netWorth,
      totalCash,
      totalBank,
      totalMobile,
      totalIncome,
      totalExpense,
      netSavings,
      totalReceivables,
      totalPayables,
      totalTransactions: transactions.length,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to compute reports summary.' });
  }
}

export async function exportData(req, res) {
  try {
    const userId = req.user.id;
    const accounts = await dbService.getAccounts(userId);
    const categories = await dbService.getCategories(userId);
    const transactions = await dbService.getTransactions(userId);
    const transfers = await dbService.getTransfers(userId);
    const loans = await dbService.getLoans(userId);
    const repayments = await dbService.getRepayments(userId);
    const budgets = await dbService.getBudgets(userId);

    const payload = {
      app: 'HisabFlow',
      version: '2.0.0-production',
      user: {
        username: req.user.username,
        email: req.user.email,
        currency: req.user.currency,
      },
      exportedAt: new Date().toISOString(),
      data: {
        accounts,
        categories,
        transactions,
        transfers,
        loans,
        repayments,
        budgets,
      },
    };

    res.json(payload);
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate export.' });
  }
}
