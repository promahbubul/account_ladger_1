import { dbService } from '../services/db.service.js';

export async function getAccounts(req, res) {
  try {
    let accounts = await dbService.getAccounts(req.user.id);

    if (req.query.type && req.query.type !== 'ALL') {
      accounts = accounts.filter((a) => a.type === req.query.type);
    }
    if (req.query.status && req.query.status !== 'ALL') {
      accounts = accounts.filter((a) => a.status === req.query.status);
    }
    if (req.query.search && req.query.search.trim()) {
      const term = req.query.search.trim().toLowerCase();
      accounts = accounts.filter(
        (a) =>
          a.name.toLowerCase().includes(term) ||
          (a.providerName && a.providerName.toLowerCase().includes(term)) ||
          (a.accountNumber && a.accountNumber.toLowerCase().includes(term))
      );
    }

    const totalCount = accounts.length;
    const isPaginate = req.query.paginate === 'true';

    if (isPaginate) {
      const limit = Number(req.query.limit) || 50;
      const page = req.query.page ? Math.max(1, parseInt(req.query.page, 10)) : 1;
      const startIndex = (page - 1) * limit;
      const items = accounts.slice(startIndex, startIndex + limit);
      const hasNextPage = startIndex + limit < totalCount;
      const hasPreviousPage = startIndex > 0;

      res.json({
        success: true,
        accounts,
        items,
        totalCount,
        hasNextPage,
        hasPreviousPage,
      });
      return;
    }

    res.json({ success: true, accounts, items: accounts, totalCount });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch accounts.' });
  }
}

export async function createAccount(req, res) {
  try {
    const { name, type, providerName, accountNumber, openingBalance } = req.body;
    if (!name || !type) {
      res.status(400).json({ error: 'Account name and type are required.' });
      return;
    }

    const initialBal = Number(openingBalance) || 0;
    const newAccount = {
      id: `acc_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      userId: req.user.id,
      name: String(name).trim(),
      type,
      providerName: providerName ? String(providerName).trim() : null,
      accountNumber: accountNumber ? String(accountNumber).trim() : null,
      openingBalance: initialBal,
      currentBalance: initialBal,
      currency: req.user.currency || 'BDT',
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const created = await dbService.createAccount(newAccount);
    res.status(201).json({ success: true, account: created });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create account.' });
  }
}

export async function updateAccount(req, res) {
  try {
    const { id } = req.params;
    const { name, type, providerName, accountNumber, currentBalance, status } = req.body;

    const updates = {};
    if (name !== undefined) updates.name = String(name).trim();
    if (type !== undefined) updates.type = type;
    if (providerName !== undefined) updates.providerName = String(providerName).trim();
    if (accountNumber !== undefined) updates.accountNumber = String(accountNumber).trim();
    if (currentBalance !== undefined) updates.currentBalance = Number(currentBalance);
    if (status !== undefined) updates.status = status;

    const updated = await dbService.updateAccount(id, req.user.id, updates);
    if (!updated) {
      res.status(404).json({ error: 'Account not found.' });
      return;
    }
    res.json({ success: true, account: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update account.' });
  }
}

export async function archiveAccount(req, res) {
  try {
    const { id } = req.params;
    const account = await dbService.getAccountById(req.user.id, id);
    if (!account) {
      res.status(404).json({ error: 'Account not found.' });
      return;
    }

    const nextStatus = account.status === 'ACTIVE' ? 'ARCHIVED' : 'ACTIVE';
    const updated = await dbService.updateAccount(id, req.user.id, { status: nextStatus });
    res.json({ success: true, account: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update account status.' });
  }
}

export async function deleteAccount(req, res) {
  try {
    const { id } = req.params;
    const result = await dbService.deleteAccount(id, req.user.id);
    if (!result.success) {
      res.status(400).json({ error: result.error || 'Failed to delete account.' });
      return;
    }
    res.json({ success: true, message: 'Account deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete account.' });
  }
}
