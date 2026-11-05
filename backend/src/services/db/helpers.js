// Shared row mappers, SELECT lists and SQL filter builders for the database service.

export function formatToISODate(d) {
  if (!d) return '';
  if (typeof d === 'string') return d.slice(0, 10);
  if (d instanceof Date) {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return String(d).slice(0, 10);
}


export const DEFAULT_INCOME_CATEGORIES = [
  { name: 'Salary & Wages', icon: 'Briefcase', color: '#10b981', subcategories: ['Basic Salary', 'Bonus', 'Commission', 'Overtime'] },
  { name: 'Business & Sales', icon: 'Building2', color: '#06b6d4', subcategories: ['Product Sales', 'Service Revenue', 'Client Consulting'] },
  { name: 'Investments & Returns', icon: 'TrendingUp', color: '#3b82f6', subcategories: ['Stock Dividends', 'Capital Gains', 'Bank Profit/Interest'] },
  { name: 'Freelance & Contracting', icon: 'Laptop', color: '#8b5cf6', subcategories: ['Upwork/Fiverr', 'Direct Clients', 'Project Deliverables'] },
  { name: 'Rental Income', icon: 'Home', color: '#ec4899', subcategories: ['Residential Rent', 'Commercial Rent', 'Parking Space'] },
  { name: 'Other Income', icon: 'Coins', color: '#64748b', subcategories: ['Gifts & Family Support', 'Tax Refund', 'Reimbursements', 'Asset Liquidation'] },
];

export const DB_CONNECT_ATTEMPTS = 5;

export const DEFAULT_EXPENSE_CATEGORIES = [
  { name: 'Food & Dining', icon: 'UtensilsCrossed', color: '#f59e0b', subcategories: ['Groceries & Provisions', 'Dining Out & Restaurants', 'Snacks & Cafes', 'Water & Milk'] },
  { name: 'Housing & Utilities', icon: 'Home', color: '#ef4444', subcategories: ['Apartment Rent', 'Electricity Bill', 'Gas & Cylinder', 'Water Bill', 'Internet & Fiber', 'Building Service Charge'] },
  { name: 'Transportation', icon: 'Car', color: '#3b82f6', subcategories: ['Vehicle Fuel & CNG', 'Public Bus & Metro', 'Ride Sharing (Uber/Pathao)', 'Vehicle Maintenance', 'Tolls & Parking'] },
  { name: 'Healthcare & Medical', icon: 'HeartPulse', color: '#ec4899', subcategories: ['Prescription Medicines', 'Doctor Consultation', 'Medical Diagnostic Tests', 'Hospital Care', 'Dental & Vision'] },
  { name: 'Family & Education', icon: 'GraduationCap', color: '#8b5cf6', subcategories: ['Tuition & School Fees', 'Books & Stationery', 'Courses & Learning', 'Children Allowances', 'Parental Support'] },
  { name: 'Shopping & Apparel', icon: 'ShoppingBag', color: '#14b8a6', subcategories: ['Clothing & Footwear', 'Electronics & Gadgets', 'Home Appliances', 'Gifts & Celebrations'] },
  { name: 'Personal Care & Lifestyle', icon: 'Smile', color: '#06b6d4', subcategories: ['Grooming & Salon', 'Gym & Fitness', 'Streaming Subscriptions', 'Entertainment & Outings'] },
  { name: 'Financial & Banking', icon: 'Landmark', color: '#64748b', subcategories: ['Bank Service Charges', 'Card Annual Fees', 'Mobile Money Cashout Fees', 'Government Taxes'] },
  { name: 'Miscellaneous', icon: 'Receipt', color: '#94a3b8', subcategories: ['Emergency Repairs', 'Unplanned Incidentals', 'General Donations'] },
];

export const TRANSFER_SELECT =
  'SELECT id, user_id as "userId", source_account_id as "sourceAccountId", source_account_name as "sourceAccountName", destination_account_id as "destinationAccountId", destination_account_name as "destinationAccountName", amount, transfer_fee as "transferFee", date, description, reference, created_at as "createdAt" FROM transfers';
export const mapTransferRow = (r) => ({
  ...r,
  amount: Number(r.amount),
  transferFee: Number(r.transferFee || 0),
  date: typeof r.date === 'string' ? r.date.slice(0, 10) : new Date(r.date).toISOString().slice(0, 10),
  createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : (r.createdAt ? String(r.createdAt) : new Date().toISOString()),
});

export const LOAN_SELECT =
  'SELECT id, user_id as "userId", account_id as "accountId", account_name as "accountName", type, counterparty_name as "counterpartyName", counterparty_contact as "counterpartyContact", principal_amount as "principalAmount", outstanding_principal as "outstandingPrincipal", interest_rate as "interestRate", start_date as "startDate", due_date as "dueDate", status, notes, created_at as "createdAt", updated_at as "updatedAt" FROM loans';
export const mapLoanRow = (r) => ({
  ...r,
  principalAmount: Number(r.principalAmount),
  outstandingPrincipal: Number(r.outstandingPrincipal),
  interestRate: Number(r.interestRate || 0),
  startDate: typeof r.startDate === 'string' ? r.startDate.slice(0, 10) : new Date(r.startDate).toISOString().slice(0, 10),
  dueDate: r.dueDate ? (typeof r.dueDate === 'string' ? r.dueDate.slice(0, 10) : new Date(r.dueDate).toISOString().slice(0, 10)) : undefined,
  createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : (r.createdAt ? String(r.createdAt) : new Date().toISOString()),
});

export const REPAYMENT_SELECT =
  'SELECT id, user_id as "userId", loan_id as "loanId", counterparty_name as "counterpartyName", loan_type as "loanType", account_id as "accountId", account_name as "accountName", amount, date, notes, created_at as "createdAt" FROM repayments';
export const mapRepaymentRow = (r) => ({
  ...r,
  amount: Number(r.amount),
  date: typeof r.date === 'string' ? r.date.slice(0, 10) : new Date(r.date).toISOString().slice(0, 10),
  createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : (r.createdAt ? String(r.createdAt) : new Date().toISOString()),
});

export const TRANSACTION_SELECT = `
  SELECT id, user_id as "userId", account_id as "accountId", account_name as "accountName",
         category_id as "categoryId", type, category, subcategory, amount, direction, date,
         description, reference, counterparty, status, transfer_id as "transferId",
         loan_id as "loanId", destination_account_id as "destinationAccountId",
         destination_account_name as "destinationAccountName", created_at as "createdAt"
  FROM transactions`;
export const mapTransactionRow = (r) => ({
  ...r,
  amount: Number(r.amount),
  date: formatToISODate(r.date),
  createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : (r.createdAt ? String(r.createdAt) : new Date().toISOString()),
});

// ---- SQL list pages -------------------------------------------------------

export const MAX_PAGE = 1_000_000;
export const AUDIT_SELECT =
  'SELECT id, user_id as "userId", user_email as "userEmail", action, entity_type as "entityType", entity_id as "entityId", details, ip_address as "ipAddress", created_at as "createdAt" FROM audit_logs';

// A date only counts if it really exists, so a bad query value cannot become a database error.
export const isRealDate = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};

export const isCursorTimestamp = (value) =>
  typeof value === 'string' &&
  (isRealDate(value) ||
    (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/.test(value) && !Number.isNaN(Date.parse(value))));

// Builds WHERE clauses with numbered parameters.
export const sqlFilters = (first = []) => {
  const where = [...first.map(([sql]) => sql)];
  const values = first.map(([, value]) => value);
  const add = (column, operator, value) => {
    values.push(value);
    where.push(`${column} ${operator} $${values.length}`);
  };
  // % and _ typed by the user are plain text, not wildcards.
  const addSearch = (search, columns) => {
    const term = typeof search === 'string' ? search.trim().toLowerCase() : '';
    if (!term) return;
    values.push(`%${term.replace(/[\\%_]/g, '\\$&')}%`);
    const placeholder = `$${values.length}`;
    where.push(`(${columns.map((c) => `LOWER(${c}) LIKE ${placeholder} ESCAPE '\\'`).join(' OR ')})`);
  };
  return { where, values, add, addSearch };
};

export const transactionFilters = (userId, filters = {}) => {
  const query = sqlFilters([['user_id = $1', userId]]);
  if (filters.type && filters.type !== 'ALL') query.add('type', '=', filters.type);
  if (filters.accountId && filters.accountId !== 'ALL') query.add('account_id', '=', filters.accountId);
  if (filters.categoryId) query.add('category_id', '=', filters.categoryId);
  if (filters.category && filters.category !== 'ALL') query.add('category', '=', filters.category);
  if (isRealDate(filters.startDate)) query.add('date', '>=', filters.startDate);
  if (isRealDate(filters.endDate)) query.add('date', '<=', filters.endDate);
  query.addSearch(filters.search, ['description', 'reference', 'counterparty', 'category']);
  return query;
};

export const transferFilters = (userId, filters = {}) => {
  const query = sqlFilters([['user_id = $1', userId]]);
  if (filters.sourceAccountId && filters.sourceAccountId !== 'ALL') query.add('source_account_id', '=', filters.sourceAccountId);
  if (filters.destAccountId && filters.destAccountId !== 'ALL') query.add('destination_account_id', '=', filters.destAccountId);
  if (isRealDate(filters.startDate)) query.add('date', '>=', filters.startDate);
  if (isRealDate(filters.endDate)) query.add('date', '<=', filters.endDate);
  query.addSearch(filters.search, ['description', 'reference', 'source_account_name', 'destination_account_name']);
  return query;
};

export const loanFilters = (userId, filters = {}) => {
  const query = sqlFilters([['user_id = $1', userId]]);
  if (filters.type && filters.type !== 'ALL') query.add('type', '=', filters.type);
  if (filters.status && filters.status !== 'ALL') query.add('status', '=', filters.status);
  query.addSearch(filters.search, ['counterparty_name', 'counterparty_contact', 'notes']);
  return query;
};

export const repaymentFilters = (userId, filters = {}) => {
  const query = sqlFilters([['user_id = $1', userId]]);
  if (filters.loanId) query.add('loan_id', '=', filters.loanId);
  query.addSearch(filters.search, ['counterparty_name', 'notes']);
  return query;
};

export const USER_SELECT =
  'SELECT id, username, email, full_name as "fullName", role, is_active as "isActive", email_verified as "emailVerified", currency, timezone, date_format as "dateFormat", created_at as "createdAt", updated_at as "updatedAt" FROM users';

export const userFilters = (filters = {}) => {
  const query = sqlFilters();
  if (filters.role && filters.role !== 'ALL') query.add('role', '=', filters.role);
  if (filters.status && filters.status !== 'ALL') query.add('is_active', '=', filters.status === 'ACTIVE');
  query.addSearch(filters.search, ['username', 'email', 'full_name']);
  return query;
};

export const auditFilters = (filters = {}) => {
  const query = sqlFilters();
  if (filters.action && filters.action !== 'ALL') query.add('action', '=', filters.action);
  query.addSearch(filters.search, ['action', 'entity_type', 'user_email', 'details']);
  return query;
};
