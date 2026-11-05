import { useCallback, useMemo } from 'react';
import { useFinance } from '../../context/FinanceContext';

export const useExpenseCategories = () => {
  const { categories } = useFinance();

  // Filter all expense categories
  const allExpenseCategories = useMemo(
    () => categories.filter((c) => c.type === 'EXPENSE'),
    [categories]
  );

  // Main (parent) expense categories
  const mainExpenseCategories = useMemo(
    () => allExpenseCategories.filter((c) => !c.parentId),
    [allExpenseCategories]
  );

  // Helper to extract subcategories for a given main category name
  const getSubcategoriesForCategory = useCallback(
    (mainCatName: string): string[] => {
      const parent = allExpenseCategories.find((c) => c.name === mainCatName && !c.parentId);
      if (!parent) return [];

      const childCategories = allExpenseCategories
        .filter((c) => c.parentId === parent.id)
        .map((c) => c.name);

      const arraySubs = parent.subcategories || [];
      const combined = Array.from(new Set([...childCategories, ...arraySubs]));
      return combined;
    },
    [allExpenseCategories]
  );

  return { allExpenseCategories, mainExpenseCategories, getSubcategoriesForCategory };
};
