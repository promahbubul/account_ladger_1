import { dbService } from '../services/db.service.js';
import { validateLimit } from '../utils/cursor.js';

export async function getLoans(req, res) {
  try {
    const isAll = req.query.all === 'true';

    if (isAll) {
      const allLoans = await dbService.getLoans(req.user.id, {
        type: req.query.type,
        status: req.query.status,
        search: req.query.search,
      });
      res.json({
        success: true,
        items: allLoans,
        loans: allLoans,
        totalCount: allLoans.length,
      });
      return;
    }

    const limit = validateLimit(req.query.limit);
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
    const direction = req.query.direction === 'backward' ? 'backward' : 'forward';
    const type = typeof req.query.type === 'string' ? req.query.type : undefined;
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;

    const result = await dbService.getPaginatedLoans(req.user.id, {
      limit,
      cursor,
      direction,
      type,
      status,
      search,
    });

    res.json({
      success: true,
      items: result.items,
      loans: result.items,
      nextCursor: result.nextCursor,
      previousCursor: result.previousCursor,
      hasNextPage: result.hasNextPage,
      hasPreviousPage: result.hasPreviousPage,
      totalCount: result.totalCount,
    });
  } catch (err) {
    if (err.message && err.message.includes('Invalid limit')) {
      res.status(400).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: 'Failed to fetch loans.' });
  }
}

export async function getRepayments(req, res) {
  try {
    const isAll = req.query.all === 'true';

    if (isAll) {
      const allReps = await dbService.getRepayments(req.user.id, {
        loanId: req.query.loanId,
        search: req.query.search,
      });
      res.json({
        success: true,
        items: allReps,
        repayments: allReps,
        totalCount: allReps.length,
      });
      return;
    }

    const limit = validateLimit(req.query.limit);
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
    const direction = req.query.direction === 'backward' ? 'backward' : 'forward';
    const loanId = typeof req.query.loanId === 'string' ? req.query.loanId : undefined;
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;

    const result = await dbService.getPaginatedRepayments(req.user.id, {
      limit,
      cursor,
      direction,
      loanId,
      search,
    });

    res.json({
      success: true,
      items: result.items,
      repayments: result.items,
      nextCursor: result.nextCursor,
      previousCursor: result.previousCursor,
      hasNextPage: result.hasNextPage,
      hasPreviousPage: result.hasPreviousPage,
      totalCount: result.totalCount,
    });
  } catch (err) {
    if (err.message && err.message.includes('Invalid limit')) {
      res.status(400).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: 'Failed to fetch repayments.' });
  }
}

export async function createLoan(req, res) {
  try {
    const {
      accountId,
      type,
      counterpartyName,
      counterpartyContact,
      principalAmount,
      interestRate,
      startDate,
      dueDate,
      notes,
    } = req.body;

    if (!accountId || !type || !counterpartyName || !principalAmount || !startDate) {
      res.status(400).json({ error: 'Account, loan type, person name, amount, and start date are required.' });
      return;
    }

    const accounts = await dbService.getAccounts(req.user.id);
    const acc = accounts.find((a) => a.id === accountId);
    if (!acc) {
      res.status(404).json({ error: 'Account not found.' });
      return;
    }

    const cleanPrincipal = Number(principalAmount);
    if (isNaN(cleanPrincipal) || cleanPrincipal <= 0) {
      res.status(400).json({ error: 'Principal amount must be a positive number.' });
      return;
    }

    const cleanType = type.toUpperCase() === 'BORROWED' ? 'BORROWED' : 'LENT';

    const loan = {
      id: `loan_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      userId: req.user.id,
      accountId,
      accountName: acc.name,
      type: cleanType,
      counterpartyName: String(counterpartyName).trim(),
      counterpartyContact: counterpartyContact ? String(counterpartyContact).trim() : null,
      principalAmount: cleanPrincipal,
      outstandingPrincipal: cleanPrincipal,
      interestRate: Number(interestRate) || 0,
      startDate: String(startDate).slice(0, 10),
      dueDate: dueDate ? String(dueDate).slice(0, 10) : null,
      status: 'ACTIVE',
      notes: notes ? String(notes).trim() : null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const created = await dbService.createLoan(loan);
    res.status(201).json({ success: true, loan: created });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create loan record.' });
  }
}

export async function deleteLoan(req, res) {
  try {
    const { id } = req.params;
    const deleted = await dbService.deleteLoan(id, req.user.id);
    if (!deleted) {
      res.status(404).json({ error: 'Loan not found.' });
      return;
    }
    res.json({ success: true, message: 'Loan deleted and account balance reversed.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete loan.' });
  }
}

export async function addRepayment(req, res) {
  try {
    const { id } = req.params;
    const { amount, date, accountId, notes } = req.body;

    if (!amount || !date || !accountId) {
      res.status(400).json({ error: 'Amount, date, and receiving/paying account are required.' });
      return;
    }

    const loans = await dbService.getLoans(req.user.id);
    const loan = loans.find((l) => l.id === id);
    if (!loan) {
      res.status(404).json({ error: 'Loan not found.' });
      return;
    }

    const accounts = await dbService.getAccounts(req.user.id);
    const acc = accounts.find((a) => a.id === accountId);
    if (!acc) {
      res.status(404).json({ error: 'Selected account not found.' });
      return;
    }

    const cleanAmount = Number(amount);
    if (isNaN(cleanAmount) || cleanAmount <= 0) {
      res.status(400).json({ error: 'Repayment amount must be a positive number.' });
      return;
    }

    const repayment = {
      id: `rep_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      userId: req.user.id,
      loanId: id,
      counterpartyName: loan.counterpartyName,
      loanType: loan.type,
      accountId,
      accountName: acc.name,
      amount: cleanAmount,
      date: String(date).slice(0, 10),
      notes: notes ? String(notes).trim() : null,
      createdAt: new Date().toISOString(),
    };

    const recorded = await dbService.addRepayment(repayment);
    res.status(201).json({ success: true, repayment: recorded });
  } catch (err) {
    res.status(500).json({ error: 'Failed to record repayment.' });
  }
}
