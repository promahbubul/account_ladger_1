// Income and expense categories. Mixed into DatabaseService, so `this` is the service.

export class CategoriesMethods {
  async getCategories(userId) {
    if (this.isPostgresConnected && this.pool) {
      const res = await this.pool.query(
        'SELECT id, user_id as "userId", parent_id as "parentId", name, type, icon, color, subcategories, is_archived as "isArchived", is_system as "isSystem", created_at as "createdAt", updated_at as "updatedAt" FROM categories WHERE user_id = $1 ORDER BY name ASC',
        [userId]
      );
      const all = res.rows;
      const childMap = new Map();
      for (const c of all) {
        if (c.parentId) {
          if (!childMap.has(c.parentId)) childMap.set(c.parentId, []);
          childMap.get(c.parentId).push(c.name);
        }
      }
      return all.map((c) => {
        const extraSubs = childMap.get(c.id) || [];
        const existingSubs = Array.isArray(c.subcategories) ? c.subcategories : [];
        const combined = Array.from(new Set([...existingSubs, ...extraSubs]));
        return {
          ...c,
          subcategories: combined,
        };
      });
    }
    return this.inMemoryData.categories.filter((c) => c.userId === userId);
  }

  async createCategory(category) {
    if (this.isPostgresConnected && this.pool) {
      await this.pool.query(
        `INSERT INTO categories (id, user_id, parent_id, name, type, icon, color, subcategories, is_archived, is_system)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          category.id,
          category.userId,
          category.parentId || null,
          category.name,
          category.type,
          category.icon || null,
          category.color || null,
          JSON.stringify(category.subcategories || []),
          Boolean(category.isArchived),
          Boolean(category.isSystem),
        ]
      );
      return category;
    }
    this.inMemoryData.categories.push(category);
    this.persistLocalDb();
    return category;
  }

  async updateCategory(id, userId, updates) {
    if (this.isPostgresConnected && this.pool) {
      const fields = [];
      const values = [];
      let i = 1;

      if (updates.name !== undefined) {
        fields.push(`name = $${i++}`);
        values.push(updates.name);
      }
      if (updates.icon !== undefined) {
        fields.push(`icon = $${i++}`);
        values.push(updates.icon);
      }
      if (updates.color !== undefined) {
        fields.push(`color = $${i++}`);
        values.push(updates.color);
      }
      if (updates.subcategories !== undefined) {
        fields.push(`subcategories = $${i++}`);
        values.push(JSON.stringify(updates.subcategories));
      }
      if (updates.isArchived !== undefined) {
        fields.push(`is_archived = $${i++}`);
        values.push(updates.isArchived);
      }
      if (updates.parentId !== undefined) {
        fields.push(`parent_id = $${i++}`);
        values.push(updates.parentId || null);
      }

      fields.push(`updated_at = NOW()`);
      values.push(id, userId);

      // Transactions and budgets store the category by name, so a rename must move them too.
      const client = await this.pool.connect();
      try {
        await client.query('BEGIN');
        const before = await client.query(
          'SELECT name, type, parent_id FROM categories WHERE id = $1 AND user_id = $2 FOR UPDATE',
          [id, userId]
        );
        await client.query(
          `UPDATE categories SET ${fields.join(', ')} WHERE id = $${i++} AND user_id = $${i}`,
          values
        );
        const old = before.rows[0];
        if (old && updates.name !== undefined && updates.name !== old.name) {
          await client.query(
            'UPDATE transactions SET category = $1 WHERE user_id = $2 AND category = $3 AND type = $4',
            [updates.name, userId, old.name, old.type]
          );
          if (old.type === 'EXPENSE') {
            await client.query(
              `UPDATE budgets SET category_name = $1 WHERE user_id = $2 AND category_name = $3
               AND NOT EXISTS (SELECT 1 FROM budgets b WHERE b.user_id = $2 AND b.category_name = $1)`,
              [updates.name, userId, old.name]
            );
          }
          if (old.parent_id) {
            const parent = await client.query(
              'SELECT name, subcategories FROM categories WHERE id = $1 AND user_id = $2',
              [old.parent_id, userId]
            );
            if (parent.rows[0]) {
              await client.query('UPDATE categories SET subcategories = $1 WHERE id = $2 AND user_id = $3', [
                JSON.stringify((parent.rows[0].subcategories || []).map((name) => (name === old.name ? updates.name : name))),
                old.parent_id,
                userId,
              ]);
              await client.query(
                'UPDATE transactions SET subcategory = $1 WHERE user_id = $2 AND category = $3 AND subcategory = $4',
                [updates.name, userId, parent.rows[0].name, old.name]
              );
            }
          }
        }
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
      const all = await this.getCategories(userId);
      return all.find((c) => c.id === id) || null;
    }

    const idx = this.inMemoryData.categories.findIndex((c) => c.id === id && c.userId === userId);
    if (idx !== -1) {
      const old = this.inMemoryData.categories[idx];
      if (updates.name !== undefined && updates.name !== old.name) {
        const parent = this.inMemoryData.categories.find((c) => c.id === old.parentId && c.userId === userId);
        for (const tx of this.inMemoryData.transactions) {
          if (tx.userId !== userId) continue;
          if (tx.category === old.name && tx.type === old.type) tx.category = updates.name;
          if (parent && tx.category === parent.name && tx.subcategory === old.name) tx.subcategory = updates.name;
        }
        if (old.type === 'EXPENSE' && !this.inMemoryData.budgets.some((b) => b.userId === userId && b.categoryName === updates.name)) {
          for (const budget of this.inMemoryData.budgets) {
            if (budget.userId === userId && budget.categoryName === old.name) budget.categoryName = updates.name;
          }
        }
        if (parent) {
          parent.subcategories = (parent.subcategories || []).map((name) => (name === old.name ? updates.name : name));
        }
      }
      this.inMemoryData.categories[idx] = {
        ...this.inMemoryData.categories[idx],
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      this.persistLocalDb();
      return this.inMemoryData.categories[idx];
    }
    return null;
  }

  async deleteCategory(id, userId) {
    if (this.isPostgresConnected && this.pool) {
      await this.pool.query('DELETE FROM categories WHERE id = $1 AND user_id = $2', [id, userId]);
      return { success: true };
    }
    const idx = this.inMemoryData.categories.findIndex((c) => c.id === id && c.userId === userId);
    if (idx !== -1) {
      this.inMemoryData.categories.splice(idx, 1);
      this.persistLocalDb();
      return { success: true };
    }
    return { success: false, error: 'Category not found.' };
  }

  // --------------------------------------------------------------------------
  // TRANSACTIONS OPERATIONS
  // --------------------------------------------------------------------------
}
