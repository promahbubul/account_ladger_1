// Active top-level categories of one type, with archived child categories removed from their subcategories.
export const getSelectableCategories = (categories = [], type) => {
  const archivedChildNames = new Set(
    categories.filter((c) => c.parentId && c.isArchived).map((c) => c.name)
  );

  return categories
    .filter((c) => c.type === type && !c.isArchived && !c.parentId)
    .map((c) => ({
      ...c,
      subcategories: (c.subcategories || []).filter((name) => !archivedChildNames.has(name)),
    }));
};
