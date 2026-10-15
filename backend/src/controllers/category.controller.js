import { dbService } from '../services/db.service.js';

export async function getCategories(req, res) {
  try {
    const categories = await dbService.getCategories(req.user.id);
    res.json({ success: true, categories });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch categories.' });
  }
}

export async function createCategory(req, res) {
  try {
    const { name, type, icon, color, subcategories } = req.body;
    if (!name || !type) {
      res.status(400).json({ error: 'Category name and type (INCOME/EXPENSE) are required.' });
      return;
    }

    const cleanType = type.toUpperCase() === 'INCOME' ? 'INCOME' : 'EXPENSE';
    const newCategory = {
      id: `cat_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      userId: req.user.id,
      name: String(name).trim(),
      type: cleanType,
      icon: icon || 'Tag',
      color: color || '#3b82f6',
      subcategories: Array.isArray(subcategories) ? subcategories : [],
      isArchived: false,
      isSystem: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const created = await dbService.createCategory(newCategory);
    res.status(201).json({ success: true, category: created });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create category.' });
  }
}

export async function updateCategory(req, res) {
  try {
    const { id } = req.params;
    const { name, icon, color, subcategories, isArchived } = req.body;

    const updates = {};
    if (name !== undefined) updates.name = String(name).trim();
    if (icon !== undefined) updates.icon = icon;
    if (color !== undefined) updates.color = color;
    if (subcategories !== undefined) updates.subcategories = subcategories;
    if (isArchived !== undefined) updates.isArchived = Boolean(isArchived);

    const updated = await dbService.updateCategory(id, req.user.id, updates);
    if (!updated) {
      res.status(404).json({ error: 'Category not found.' });
      return;
    }
    res.json({ success: true, category: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update category.' });
  }
}

export async function addSubcategory(req, res) {
  try {
    const { id } = req.params;
    const { subcategory } = req.body;

    if (!subcategory || !String(subcategory).trim()) {
      res.status(400).json({ error: 'Subcategory name is required.' });
      return;
    }

    const categories = await dbService.getCategories(req.user.id);
    const cat = categories.find((c) => c.id === id);
    if (!cat) {
      res.status(404).json({ error: 'Category not found.' });
      return;
    }

    const clean = String(subcategory).trim();
    const existingSubs = cat.subcategories || [];
    if (!existingSubs.includes(clean)) {
      existingSubs.push(clean);
      await dbService.updateCategory(id, req.user.id, { subcategories: existingSubs });
    }

    res.json({ success: true, subcategories: existingSubs });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add subcategory.' });
  }
}

export async function archiveCategory(req, res) {
  try {
    const { id } = req.params;
    const categories = await dbService.getCategories(req.user.id);
    const cat = categories.find((c) => c.id === id);
    if (!cat) {
      res.status(404).json({ error: 'Category not found.' });
      return;
    }

    const updated = await dbService.updateCategory(id, req.user.id, { isArchived: !cat.isArchived });
    res.json({ success: true, category: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to archive category.' });
  }
}

export async function deleteCategory(req, res) {
  try {
    const { id } = req.params;
    const result = await dbService.deleteCategory(id, req.user.id);
    if (!result.success) {
      res.status(400).json({ error: result.error || 'Failed to delete category.' });
      return;
    }
    res.json({ success: true, message: 'Category deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete category.' });
  }
}
