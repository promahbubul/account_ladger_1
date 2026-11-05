// Report totals and analytics. Mixed into DatabaseService, so `this` is the service.

export class ReportsMethods {
  // Totals are summed by the database, so they neither load every row nor pick up floating point drift.
  async getTransactionTotals(userId, { startDate, endDate } = {}) {
    if (this.isPostgresConnected && this.pool) {
      const res = await this.pool.query(
        `SELECT
           COALESCE(SUM(amount) FILTER (WHERE type = 'INCOME'), 0) AS "totalIncome",
           COALESCE(SUM(amount) FILTER (WHERE type = 'EXPENSE'), 0) AS "totalExpense",
           COUNT(*) AS "totalTransactions"
         FROM transactions
         WHERE user_id = $1
           AND ($2::date IS NULL OR date >= $2::date)
           AND ($3::date IS NULL OR date <= $3::date)`,
        [userId, startDate || null, endDate || null]
      );
      const row = res.rows[0];
      return {
        totalIncome: Number(row.totalIncome),
        totalExpense: Number(row.totalExpense),
        totalTransactions: Number(row.totalTransactions),
      };
    }

    const transactions = await this.getTransactions(userId, { startDate, endDate });
    const sumCents = (type) =>
      transactions.filter((t) => t.type === type).reduce((sum, t) => sum + Math.round(t.amount * 100), 0);
    return {
      totalIncome: sumCents('INCOME') / 100,
      totalExpense: sumCents('EXPENSE') / 100,
      totalTransactions: transactions.length,
    };
  }

  // byCategory, totals and byAccount follow the selected period; monthly always spans the 12 months
  // ending at its end, because a trend over a single month would show only one bar.
  // totals and byAccount count by direction, and a legacy TRANSFER row also counts as outflow from
  // its account and inflow to its destination, matching what the web report used to sum itself.
  async getReportAnalytics(userId, { startDate, endDate } = {}) {
    const today = new Date().toISOString().slice(0, 10);
    const end = endDate || today;
    const [endYear, endMonth] = end.split('-').map(Number);
    const months = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(Date.UTC(endYear, endMonth - 12 + i, 1));
      return d.toISOString().slice(0, 7);
    });
    const trendStart = `${months[0]}-01`;

    let byCategory;
    let monthlyRows;
    let totals;
    let byAccount;
    if (this.isPostgresConnected && this.pool) {
      const periodValues = [userId, startDate || null, endDate || null];
      const inPeriod = `user_id = $1
           AND ($2::date IS NULL OR date >= $2::date)
           AND ($3::date IS NULL OR date <= $3::date)`;
      const totalsRes = await this.pool.query(
        `SELECT COALESCE(SUM(amount) FILTER (WHERE direction = 'INFLOW'), 0)::float8 AS inflow,
                COALESCE(SUM(amount) FILTER (WHERE direction = 'OUTFLOW'), 0)::float8 AS outflow
         FROM transactions WHERE ${inPeriod}`,
        periodValues
      );
      totals = totalsRes.rows[0];
      const accountsRes = await this.pool.query(
        `SELECT account_id AS "accountId", SUM(inflow)::float8 AS inflow, SUM(outflow)::float8 AS outflow
         FROM (
           SELECT account_id,
                  CASE WHEN direction = 'INFLOW' THEN amount ELSE 0 END AS inflow,
                  CASE WHEN direction = 'OUTFLOW' THEN amount ELSE 0 END
                    + CASE WHEN type = 'TRANSFER' THEN amount ELSE 0 END AS outflow
           FROM transactions WHERE ${inPeriod}
           UNION ALL
           SELECT destination_account_id, amount, 0
           FROM transactions WHERE ${inPeriod} AND type = 'TRANSFER' AND destination_account_id IS NOT NULL
         ) flows
         WHERE account_id IS NOT NULL
         GROUP BY account_id`,
        periodValues
      );
      byAccount = accountsRes.rows;
      const categories = await this.pool.query(
        `SELECT COALESCE(NULLIF(category, ''), 'Uncategorized') AS name, SUM(amount)::float8 AS amount, COUNT(*)::int AS count
         FROM transactions
         WHERE user_id = $1 AND type = 'EXPENSE'
           AND ($2::date IS NULL OR date >= $2::date)
           AND ($3::date IS NULL OR date <= $3::date)
         GROUP BY 1 ORDER BY amount DESC`,
        [userId, startDate || null, endDate || null]
      );
      byCategory = categories.rows;
      const monthly = await this.pool.query(
        `SELECT to_char(date, 'YYYY-MM') AS month,
                COALESCE(SUM(amount) FILTER (WHERE type = 'INCOME'), 0)::float8 AS income,
                COALESCE(SUM(amount) FILTER (WHERE type = 'EXPENSE'), 0)::float8 AS expense
         FROM transactions
         WHERE user_id = $1 AND date >= $2::date AND date <= $3::date
         GROUP BY 1`,
        [userId, trendStart, end]
      );
      monthlyRows = monthly.rows;
    } else {
      const inPeriod = await this.getTransactions(userId, { startDate, endDate });
      const cents = new Map();
      for (const t of inPeriod.filter((tx) => tx.type === 'EXPENSE')) {
        const name = t.category || 'Uncategorized';
        const row = cents.get(name) || { cents: 0, count: 0 };
        row.cents += Math.round(t.amount * 100);
        row.count += 1;
        cents.set(name, row);
      }
      byCategory = [...cents.entries()]
        .map(([name, row]) => ({ name, amount: row.cents / 100, count: row.count }))
        .sort((a, b) => b.amount - a.amount);

      const totalCents = { inflow: 0, outflow: 0 };
      const accountCents = new Map();
      const addFlow = (accountId, key, value) => {
        if (!accountId) return;
        const row = accountCents.get(accountId) || { inflow: 0, outflow: 0 };
        row[key] += value;
        accountCents.set(accountId, row);
      };
      for (const t of inPeriod) {
        const value = Math.round(t.amount * 100);
        if (t.direction === 'INFLOW') {
          totalCents.inflow += value;
          addFlow(t.accountId, 'inflow', value);
        }
        if (t.direction === 'OUTFLOW') {
          totalCents.outflow += value;
          addFlow(t.accountId, 'outflow', value);
        }
        if (t.type === 'TRANSFER') {
          addFlow(t.accountId, 'outflow', value);
          addFlow(t.destinationAccountId, 'inflow', value);
        }
      }
      totals = { inflow: totalCents.inflow / 100, outflow: totalCents.outflow / 100 };
      byAccount = [...accountCents.entries()].map(([accountId, row]) => ({
        accountId,
        inflow: row.inflow / 100,
        outflow: row.outflow / 100,
      }));

      const inTrend = await this.getTransactions(userId, { startDate: trendStart, endDate: end });
      const byMonth = new Map();
      for (const t of inTrend) {
        const month = String(t.date).slice(0, 7);
        const row = byMonth.get(month) || { income: 0, expense: 0 };
        if (t.type === 'INCOME') row.income += Math.round(t.amount * 100);
        if (t.type === 'EXPENSE') row.expense += Math.round(t.amount * 100);
        byMonth.set(month, row);
      }
      monthlyRows = [...byMonth.entries()].map(([month, row]) => ({ month, income: row.income / 100, expense: row.expense / 100 }));
    }

    const found = new Map(monthlyRows.map((row) => [row.month, row]));
    return {
      byCategory,
      totals,
      byAccount,
      monthly: months.map((month) => found.get(month) || { month, income: 0, expense: 0 }),
    };
  }
}
