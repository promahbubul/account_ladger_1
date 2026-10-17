import { dbService } from '../services/db.service.js';
import { validateLimit } from '../utils/cursor.js';

export async function getTransactions(req, res) {
  try {
    const isAll = req.query.all === 'true';

    if (isAll) {
      const allTxs = await dbService.getTransactions(req.user.id, {
        type: req.query.type,
        accountId: req.query.accountId,
        category: req.query.category,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        search: req.query.search,
      });
      res.json({
        success: true,
        items: allTxs,
        transactions: allTxs,
        totalCount: allTxs.length,
      });
      return;
    }

    const limit = validateLimit(req.query.limit);
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
    const page = req.query.page ? parseInt(req.query.page, 10) : undefined;
    const direction = req.query.direction === 'backward' ? 'backward' : 'forward';
    const type = typeof req.query.type === 'string' ? req.query.type : undefined;
    const accountId = typeof req.query.accountId === 'string' ? req.query.accountId : undefined;
    const category = typeof req.query.category === 'string' ? req.query.category : undefined;
    const startDate = typeof req.query.startDate === 'string' ? req.query.startDate : undefined;
    const endDate = typeof req.query.endDate === 'string' ? req.query.endDate : undefined;
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;

    const result = await dbService.getPaginatedTransactions(req.user.id, {
      limit,
      cursor,
      page: (page && page > 0) ? page : undefined,
      direction,
      type,
      accountId,
      category,
      startDate,
      endDate,
      search,
    });

    res.json({
      success: true,
      items: result.items,
      transactions: result.items,
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
    res.status(500).json({ error: 'Failed to fetch transactions.' });
  }
}

export async function createIncome(req, res) {
  try {
    const { accountId, amount, date, description, category, subcategory, reference, counterparty } = req.body;
    if (!accountId || !amount || !date || !description) {
      res.status(400).json({ error: 'Account, amount, date, and description are required.' });
      return;
    }

    const accounts = await dbService.getAccounts(req.user.id);
    const acc = accounts.find((a) => a.id === accountId);
    if (!acc) {
      res.status(404).json({ error: 'Account not found.' });
      return;
    }

    const cleanAmount = Number(amount);
    if (isNaN(cleanAmount) || cleanAmount <= 0) {
      res.status(400).json({ error: 'Amount must be a positive number.' });
      return;
    }

    const tx = {
      id: `tx_inc_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      userId: req.user.id,
      accountId,
      accountName: acc.name,
      type: 'INCOME',
      category: category || 'Other Income',
      subcategory: subcategory || null,
      amount: cleanAmount,
      direction: 'INFLOW',
      date: parseDateToISO(date) || String(date).slice(0, 10),
      description: String(description).trim(),
      reference: reference ? String(reference).trim() : null,
      counterparty: counterparty ? String(counterparty).trim() : null,
      status: 'COMPLETED',
      createdAt: new Date().toISOString(),
    };

    const created = await dbService.createTransaction(tx);
    res.status(201).json({ success: true, transaction: created });
  } catch (err) {
    res.status(500).json({ error: 'Failed to record income transaction.' });
  }
}

export async function createExpense(req, res) {
  try {
    const { accountId, amount, date, description, category, subcategory, reference, counterparty } = req.body;
    if (!accountId || !amount || !date || !description) {
      res.status(400).json({ error: 'Account, amount, date, and description are required.' });
      return;
    }

    const accounts = await dbService.getAccounts(req.user.id);
    const acc = accounts.find((a) => a.id === accountId);
    if (!acc) {
      res.status(404).json({ error: 'Account not found.' });
      return;
    }

    const cleanAmount = Number(amount);
    if (isNaN(cleanAmount) || cleanAmount <= 0) {
      res.status(400).json({ error: 'Amount must be a positive number.' });
      return;
    }

    const tx = {
      id: `tx_exp_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      userId: req.user.id,
      accountId,
      accountName: acc.name,
      type: 'EXPENSE',
      category: category || 'Miscellaneous',
      subcategory: subcategory || null,
      amount: cleanAmount,
      direction: 'OUTFLOW',
      date: parseDateToISO(date) || String(date).slice(0, 10),
      description: String(description).trim(),
      reference: reference ? String(reference).trim() : null,
      counterparty: counterparty ? String(counterparty).trim() : null,
      status: 'COMPLETED',
      createdAt: new Date().toISOString(),
    };

    const created = await dbService.createTransaction(tx);
    res.status(201).json({ success: true, transaction: created });
  } catch (err) {
    res.status(500).json({ error: 'Failed to record expense transaction.' });
  }
}

export async function createBulkExpense(req, res) {
  try {
    const { accountId, date, items } = req.body;
    if (!accountId || !date || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: 'Account, date, and a non-empty array of items are required.' });
      return;
    }

    const accounts = await dbService.getAccounts(req.user.id);
    const acc = accounts.find((a) => a.id === accountId);
    if (!acc) {
      res.status(404).json({ error: 'Account not found.' });
      return;
    }

    const createdTxs = [];
    for (const item of items) {
      const cleanAmount = Number(item.amount);
      if (isNaN(cleanAmount) || cleanAmount <= 0) continue;

      const tx = {
        id: `tx_exp_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        userId: req.user.id,
        accountId,
        accountName: acc.name,
        type: 'EXPENSE',
        category: item.category || 'Miscellaneous',
        subcategory: item.subcategory || null,
        amount: cleanAmount,
        direction: 'OUTFLOW',
        date: String(date).slice(0, 10),
        description: item.description ? String(item.description).trim() : 'Daily Expense',
        reference: null,
        counterparty: null,
        status: 'COMPLETED',
        createdAt: new Date().toISOString(),
      };

      const created = await dbService.createTransaction(tx);
      createdTxs.push(created);
    }

    res.status(201).json({ success: true, transactions: createdTxs, count: createdTxs.length });
  } catch (err) {
    res.status(500).json({ error: 'Failed to record bulk expenses.' });
  }
}

export function parseDateToISO(input) {
  if (!input) return null;
  const str = String(input).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.slice(0, 10);
  }
  const dmMatch = str.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (dmMatch) {
    const day = dmMatch[1].padStart(2, '0');
    const month = dmMatch[2].padStart(2, '0');
    const year = dmMatch[3];
    return `${year}-${month}-${day}`;
  }
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return null;
}

export async function updateTransaction(req, res) {
  try {
    const { id } = req.params;
    const { accountId, amount, date, description, category, subcategory, reference, counterparty } = req.body;

    const updates = {};
    if (accountId !== undefined) {
      const accounts = await dbService.getAccounts(req.user.id);
      const acc = accounts.find((a) => a.id === accountId);
      if (!acc) {
        res.status(404).json({ error: 'Account not found.' });
        return;
      }
      updates.accountId = accountId;
      updates.accountName = acc.name;
    }

    if (amount !== undefined) {
      const cleanAmount = Number(amount);
      if (isNaN(cleanAmount) || cleanAmount <= 0) {
        res.status(400).json({ error: 'Amount must be a positive number.' });
        return;
      }
      updates.amount = cleanAmount;
    }

    if (date !== undefined) {
      const dateStr = parseDateToISO(date);
      if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        res.status(400).json({ error: 'Invalid date format. Expected YYYY-MM-DD.' });
        return;
      }
      updates.date = dateStr;
    }

    if (description !== undefined) {
      const cleanDesc = String(description).trim();
      if (!cleanDesc) {
        res.status(400).json({ error: 'Description cannot be empty.' });
        return;
      }
      updates.description = cleanDesc;
    }

    if (category !== undefined) updates.category = category;
    if (subcategory !== undefined) updates.subcategory = subcategory || null;
    if (reference !== undefined) updates.reference = reference ? String(reference).trim() : null;
    if (counterparty !== undefined) updates.counterparty = counterparty ? String(counterparty).trim() : null;

    const updated = await dbService.updateTransaction(id, req.user.id, updates);
    if (!updated) {
      res.status(404).json({ error: 'Transaction not found.' });
      return;
    }
    res.json({ success: true, transaction: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update transaction.' });
  }
}

export async function deleteTransaction(req, res) {
  try {
    const { id } = req.params;
    const deleted = await dbService.deleteTransaction(id, req.user.id);
    if (!deleted) {
      res.status(404).json({ error: 'Transaction not found.' });
      return;
    }
    res.json({ success: true, message: 'Transaction deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete transaction.' });
  }
}
