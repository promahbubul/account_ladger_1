import { dbService } from '../services/db.service.js';
import { validateLimit } from '../utils/cursor.js';

export async function getTransfers(req, res) {
  try {
    const isAll = req.query.all === 'true';

    if (isAll) {
      const allTransfers = await dbService.getTransfers(req.user.id, {
        sourceAccountId: req.query.sourceAccountId,
        destAccountId: req.query.destAccountId,
        startDate: req.query.startDate,
        endDate: req.query.endDate,
        search: req.query.search,
      });
      res.json({
        success: true,
        items: allTransfers,
        transfers: allTransfers,
        totalCount: allTransfers.length,
      });
      return;
    }

    const limit = validateLimit(req.query.limit);
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
    const direction = req.query.direction === 'backward' ? 'backward' : 'forward';
    const sourceAccountId = typeof req.query.sourceAccountId === 'string' ? req.query.sourceAccountId : undefined;
    const destAccountId = typeof req.query.destAccountId === 'string' ? req.query.destAccountId : undefined;
    const startDate = typeof req.query.startDate === 'string' ? req.query.startDate : undefined;
    const endDate = typeof req.query.endDate === 'string' ? req.query.endDate : undefined;
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;

    const result = await dbService.getPaginatedTransfers(req.user.id, {
      limit,
      cursor,
      direction,
      sourceAccountId,
      destAccountId,
      startDate,
      endDate,
      search,
    });

    res.json({
      success: true,
      items: result.items,
      transfers: result.items,
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
    res.status(500).json({ error: 'Failed to fetch transfers.' });
  }
}

export async function createTransfer(req, res) {
  try {
    const { sourceAccountId, destinationAccountId, amount, transferFee, date, description, reference } = req.body;
    if (!sourceAccountId || !destinationAccountId || !amount || !date) {
      res.status(400).json({ error: 'Source account, destination account, amount, and date are required.' });
      return;
    }

    if (sourceAccountId === destinationAccountId) {
      res.status(400).json({ error: 'Source and destination accounts must be different.' });
      return;
    }

    const accounts = await dbService.getAccounts(req.user.id);
    const src = accounts.find((a) => a.id === sourceAccountId);
    const dst = accounts.find((a) => a.id === destinationAccountId);

    if (!src || !dst) {
      res.status(404).json({ error: 'One or both accounts not found.' });
      return;
    }

    const cleanAmount = Number(amount);
    if (isNaN(cleanAmount) || cleanAmount <= 0) {
      res.status(400).json({ error: 'Transfer amount must be a positive number.' });
      return;
    }

    const cleanFee = Number(transferFee) || 0;

    const transfer = {
      id: `trf_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      userId: req.user.id,
      sourceAccountId,
      sourceAccountName: src.name,
      destinationAccountId,
      destinationAccountName: dst.name,
      amount: cleanAmount,
      transferFee: cleanFee,
      date: String(date).slice(0, 10),
      description: description ? String(description).trim() : null,
      reference: reference ? String(reference).trim() : null,
      createdAt: new Date().toISOString(),
    };

    const created = await dbService.createTransfer(transfer);
    res.status(201).json({ success: true, transfer: created });
  } catch (err) {
    res.status(500).json({ error: 'Failed to record transfer.' });
  }
}

export async function deleteTransfer(req, res) {
  try {
    const { id } = req.params;
    const deleted = await dbService.deleteTransfer(id, req.user.id);
    if (!deleted) {
      res.status(404).json({ error: 'Transfer record not found.' });
      return;
    }
    res.json({ success: true, message: 'Transfer deleted and account balances reversed.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete transfer.' });
  }
}
