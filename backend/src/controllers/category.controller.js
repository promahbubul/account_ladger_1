import { dbService } from '../services/db.service.js';

export async function getCategories(req, res) {
  try {
    let categories = await dbService.getCategories(req.user.id);

    if (req.query.type && req.query.type !== 'ALL') {
      categories = categories.filter((c) => c.type === req.query.type);
    }
    if (req.query.status && req.query.status !== 'ALL') {
      const isArchived = req.query.status === 'ARCHIVED';
      categories = categories.filter((c) => Boolean(c.isArchived) === isArchived);
    }
    if (req.query.search && req.query.search.trim()) {
      const term = req.query.search.trim().toLowerCase();
      categories = categories.filter(
        (c) =>
          c.name.toLowerCase().includes(term) ||
          (c.subcategories && c.subcategories.some((s) => s.toLowerCase().includes(term)))
      );
    }

    const totalCount = categories.length;
    const isPaginate = req.query.paginate === 'true';

    if (isPaginate) {
      const limit = Number(req.query.limit) || 50;
      const page = req.query.page ? Math.max(1, parseInt(req.query.page, 10)) : 1;
      const startIndex = (page - 1) * limit;
      const items = categories.slice(startIndex, startIndex + limit);
      const hasNextPage = startIndex + limit < totalCount;
      const hasPreviousPage = startIndex > 0;

      res.json({
        success: true,
        categories,
        items,
        totalCount,
        hasNextPage,
        hasPreviousPage,
      });
      return;
    }

    res.json({ success: true, categories, items: categories, totalCount });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch categories.' });
  }
}

export async function createCategory(req, res) {
  try {
    const { name, type, icon, color, subcategories, parentId } = req.body;
    if (!name || !type) {
      res.status(400).json({ error: 'Category name and type (INCOME/EXPENSE) are required.' });
      return;
    }

    const cleanType = type.toUpperCase() === 'INCOME' ? 'INCOME' : 'EXPENSE';
    let cleanParentId = null;

    if (parentId && parentId !== 'NONE' && String(parentId).trim()) {
      const userCats = await dbService.getCategories(req.user.id);
      const parentCat = userCats.find((c) => c.id === parentId);
      if (!parentCat) {
        res.status(400).json({ error: 'Selected parent category not found.' });
        return;
      }
      if (parentCat.type !== cleanType) {
        res.status(400).json({ error: 'Subcategory must have the same type as its parent category.' });
        return;
      }
      if (parentCat.parentId) {
        res.status(400).json({ error: 'Nested subcategories beyond one level are not supported. Please select a main category.' });
        return;
      }
      cleanParentId = parentCat.id;
    }

    const newCategory = {
      id: `cat_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      userId: req.user.id,
      parentId: cleanParentId,
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

    // If subcategory was added to a parent, also add its name to parent's subcategories array if not present
    if (cleanParentId) {
      const userCats = await dbService.getCategories(req.user.id);
      const parentCat = userCats.find((c) => c.id === cleanParentId);
      if (parentCat) {
        const existingSubs = parentCat.subcategories || [];
        if (!existingSubs.includes(newCategory.name)) {
          existingSubs.push(newCategory.name);
          await dbService.updateCategory(parentCat.id, req.user.id, { subcategories: existingSubs });
        }
      }
    }

    res.status(201).json({ success: true, category: created });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create category.' });
  }
}

export async function updateCategory(req, res) {
  try {
    const { id } = req.params;
    const { name, icon, color, subcategories, isArchived, parentId } = req.body;

    const updates = {};
    if (name !== undefined) updates.name = String(name).trim();
    if (icon !== undefined) updates.icon = icon;
    if (color !== undefined) updates.color = color;
    if (subcategories !== undefined) updates.subcategories = subcategories;
    if (isArchived !== undefined) updates.isArchived = Boolean(isArchived);

    if (parentId !== undefined) {
      if (parentId === id) {
        res.status(400).json({ error: 'A category cannot be its own parent.' });
        return;
      }
      if (parentId && parentId !== 'NONE' && String(parentId).trim()) {
        const userCats = await dbService.getCategories(req.user.id);
        const parentCat = userCats.find((c) => c.id === parentId);
        if (!parentCat) {
          res.status(400).json({ error: 'Selected parent category not found.' });
          return;
        }
        if (parentCat.parentId) {
          res.status(400).json({ error: 'Nested subcategories beyond one level are not supported.' });
          return;
        }
        const hasChildren = userCats.some((c) => c.parentId === id);
        if (hasChildren) {
          res.status(400).json({ error: 'Cannot make a category with subcategories into a subcategory itself.' });
          return;
        }
        updates.parentId = parentCat.id;
      } else {
        updates.parentId = null;
      }
    }

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
    const userCats = await dbService.getCategories(req.user.id);
    const cat = userCats.find((c) => c.id === id);
    if (!cat) {
      res.status(404).json({ error: 'Category not found.' });
      return;
    }

    // Prevent deleting parent category if it has subcategories
    const hasSubcategories = userCats.some((c) => c.parentId === id);
    if (hasSubcategories) {
      res.status(400).json({ error: 'Cannot delete category that has subcategories. Please reassign or delete subcategories first.' });
      return;
    }

    // Prevent deleting category if it has existing transactions
    const txs = await dbService.getTransactions(req.user.id, { category: cat.name });
    if (txs && txs.length > 0) {
      res.status(400).json({ error: 'Cannot delete category in use by existing transactions. Please archive it instead.' });
      return;
    }

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
