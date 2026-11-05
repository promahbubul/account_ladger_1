// Monthly category budgets. Mixed into DatabaseService, so `this` is the service.

export class BudgetsMethods {
  async getBudgets(userId) {
    if (this.isPostgresConnected && this.pool) {
      const res = await this.pool.query(
        'SELECT id, user_id as "userId", category_name as "categoryName", monthly_limit as "monthlyLimit" FROM budgets WHERE user_id = $1',
        [userId]
      );
      return res.rows.map((r) => ({ ...r, monthlyLimit: Number(r.monthlyLimit) }));
    }
    return this.inMemoryData.budgets.filter((b) => b.userId === userId);
  }

  async setBudget(userId, categoryName, monthlyLimit) {
    const id = `bgt_${userId}_${categoryName.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`;
    const cleanLimit = Number(monthlyLimit);

    if (this.isPostgresConnected && this.pool) {
      await this.pool.query(
        `INSERT INTO budgets (id, user_id, category_name, monthly_limit)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (id) DO UPDATE SET monthly_limit = EXCLUDED.monthly_limit`,
        [id, userId, categoryName, cleanLimit]
      );
      return { id, userId, categoryName, monthlyLimit: cleanLimit };
    }

    const existing = this.inMemoryData.budgets.find(
      (b) => b.userId === userId && b.categoryName === categoryName
    );
    if (existing) {
      existing.monthlyLimit = cleanLimit;
      this.persistLocalDb();
      return existing;
    }
    const record = { id, userId, categoryName, monthlyLimit: cleanLimit };
    this.inMemoryData.budgets.push(record);
    this.persistLocalDb();
    return record;
  }

  async deleteBudget(userId, categoryName) {
    if (this.isPostgresConnected && this.pool) {
      await this.pool.query('DELETE FROM budgets WHERE user_id = $1 AND category_name = $2', [
        userId,
        categoryName,
      ]);
      return true;
    }
    const idx = this.inMemoryData.budgets.findIndex(
      (b) => b.userId === userId && b.categoryName === categoryName
    );
    if (idx !== -1) {
      this.inMemoryData.budgets.splice(idx, 1);
      this.persistLocalDb();
      return true;
    }
    return false;
  }

  // --------------------------------------------------------------------------
  // AUDIT LOGS & SYSTEM SETTINGS
  // --------------------------------------------------------------------------
}
