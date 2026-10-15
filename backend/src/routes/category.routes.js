import { Router } from 'express';
import {
  getCategories,
  createCategory,
  updateCategory,
  addSubcategory,
  archiveCategory,
  deleteCategory,
} from '../controllers/category.controller.js';
import { authenticateToken, requireUserOnly } from '../middleware/auth.js';

export const categoryRouter = Router();

categoryRouter.use(authenticateToken, requireUserOnly);

categoryRouter.get('/', getCategories);
categoryRouter.post('/', createCategory);
categoryRouter.put('/:id', updateCategory);
categoryRouter.post('/:id/subcategories', addSubcategory);
categoryRouter.patch('/:id/archive', archiveCategory);
categoryRouter.delete('/:id', deleteCategory);
