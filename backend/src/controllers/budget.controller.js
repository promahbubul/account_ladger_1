import { dbService } from '../services/db.service.js';

export async function getBudgets(req, res) {
  try {
    const budgets = await dbService.getBudgets(req.user.id);
    res.json({ success: true, budgets });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch budgets.' });
  }
}

export async function setBudget(req, res) {
  try {
    const { categoryName, monthlyLimit } = req.body;
    if (!categoryName || monthlyLimit === undefined) {
      res.status(400).json({ error: 'Category name and monthly limit are required.' });
      return;
    }

    const cleanLimit = Number(monthlyLimit);
    if (isNaN(cleanLimit) || cleanLimit < 0) {
      res.status(400).json({ error: 'Monthly limit must be a positive number or zero.' });
      return;
    }

    const budget = await dbService.setBudget(req.user.id, String(categoryName).trim(), cleanLimit);
    res.status(201).json({ success: true, budget });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save budget.' });
  }
}

export async function deleteBudget(req, res) {
  try {
    const { categoryName } = req.params;
    const deleted = await dbService.deleteBudget(req.user.id, decodeURIComponent(categoryName));
    if (!deleted) {
      res.status(404).json({ error: 'Budget not found.' });
      return;
    }
    res.json({ success: true, message: 'Budget removed successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete budget.' });
  }
}
