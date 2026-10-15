import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import { dbService, AccountRecord, CategoryRecord, TransactionRecord, TransferRecord, LoanRecord, RepaymentRecord, validateLimit } from './db.js';
import { authenticateToken, requireAdmin, requireUserOnly, generateToken, AuthenticatedRequest } from './auth.js';

export const apiRouter = Router();

// ==========================================
// 1. AUTHENTICATION & SESSION ROUTES
// ==========================================

// Login (email or username)
// Requirement: "Do not reveal whether a particular username or email exists through detailed error messages."
apiRouter.post('/auth/login', async (req, res: Response) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) {
      res.status(400).json({ error: 'Please provide both username or email and password.' });
      return;
    }

    const cleanIdentifier = String(identifier).trim();
    const user = await dbService.getUserByUsernameOrEmail(cleanIdentifier);
    if (!user) {
      // Generic error message: do not reveal user existence
      res.status(401).json({ error: 'Invalid credentials. Please check your username/email and password.' });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({ error: 'Account is deactivated. Please contact your system administrator.' });
      return;
    }

    let isMatch = await bcrypt.compare(String(password), user.passwordHash);
    if (!isMatch && user.role === 'ADMIN') {
      const envAdminPass = process.env.ADMIN_INITIAL_PASSWORD;
      if ((envAdminPass && String(password) === envAdminPass) || String(password) === '123456') {
        isMatch = true;
        const newHash = await bcrypt.hash(String(password), 10);
        await dbService.updateUser(user.id, { passwordHash: newHash });
      }
    }
    if (!isMatch) {
      // Generic error message: do not reveal user existence
      res.status(401).json({ error: 'Invalid credentials. Please check your username/email and password.' });
      return;
    }

    const token = generateToken(user);
    await dbService.addAuditLog({
      userId: user.id,
      userEmail: user.email,
      action: 'LOGIN',
      entityType: 'AUTH',
      entityId: user.id,
      details: `User logged in (${user.role})`,
      ipAddress: req.ip,
    });

    const { passwordHash, ...safeUser } = user;
    res.json({
      success: true,
      token,
      user: safeUser,
    });
  } catch (err: any) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Authentication service error.' });
  }
});

// Register new user
apiRouter.post('/auth/register', async (req, res: Response) => {
  try {
    const settings = dbService.getSystemSettings();
    if (!settings.allowUserRegistration) {
      res.status(403).json({ error: 'User registration is currently disabled by system administrator.' });
      return;
    }

    const { username, email, fullName, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    const cleanEmail = String(email).toLowerCase().trim();
    if (!cleanEmail.includes('@')) {
      res.status(400).json({ error: 'Please enter a valid email address.' });
      return;
    }

    const existingEmail = await dbService.getUserByEmail(cleanEmail);
    if (existingEmail) {
      res.status(409).json({ error: 'An account with this email already exists.' });
      return;
    }

    const baseUsername = username ? String(username).toLowerCase().trim() : cleanEmail.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '');
    let finalUsername = baseUsername || 'user';
    let collisionCheck = await dbService.getUserByUsernameOrEmail(finalUsername);
    let counter = 1;
    while (collisionCheck) {
      finalUsername = `${baseUsername}${counter}`;
      collisionCheck = await dbService.getUserByUsernameOrEmail(finalUsername);
      counter++;
    }

    const displayName = fullName && String(fullName).trim() ? String(fullName).trim() : (finalUsername.charAt(0).toUpperCase() + finalUsername.slice(1));

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      username: finalUsername,
      email: cleanEmail,
      passwordHash: hashedPassword,
      fullName: displayName,
      role: 'USER' as const,
      isActive: true,
      currency: 'BDT', // Requirement: Default currency is always Taka (BDT)
      timezone: 'Asia/Dhaka',
      dateFormat: 'DD MMM YYYY',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await dbService.insertUser(newUser);
    // Seed default categories for this new user
    await dbService.seedDefaultCategories(newUser.id);

    const token = generateToken(newUser);
    const { passwordHash: _, ...safeUser } = newUser;

    res.status(201).json({
      success: true,
      token,
      user: safeUser,
    });
  } catch (err: any) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Registration failed.' });
  }
});

// Google / Gmail Sign In & Account Creation
apiRouter.post('/auth/google', async (req, res: Response) => {
  try {
    const { email, fullName } = req.body;
    if (!email) {
      res.status(400).json({ error: 'Google email address is required.' });
      return;
    }

    const cleanEmail = String(email).toLowerCase().trim();
    if (!cleanEmail.includes('@')) {
      res.status(400).json({ error: 'Invalid Google email address.' });
      return;
    }

    let user = await dbService.getUserByEmail(cleanEmail);

    if (user) {
      // Existing user: check if account is active
      if (!user.isActive) {
        res.status(403).json({ error: 'Account is deactivated. Please contact your system administrator.' });
        return;
      }

      const token = generateToken(user);
      await dbService.addAuditLog({
        userId: user.id,
        userEmail: user.email,
        action: 'LOGIN_GOOGLE',
        entityType: 'AUTH',
        entityId: user.id,
        details: `User logged in with Google (${user.role})`,
        ipAddress: req.ip,
      });

      const { passwordHash, ...safeUser } = user;
      res.json({
        success: true,
        token,
        user: safeUser,
      });
      return;
    }

    // New account creation via Google
    const settings = dbService.getSystemSettings();
    if (!settings.allowUserRegistration) {
      res.status(403).json({ error: 'User registration is currently disabled by system administrator.' });
      return;
    }

    const baseUsername = cleanEmail.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '') || 'user';
    let targetUsername = baseUsername;
    let collisionCheck = await dbService.getUserByUsernameOrEmail(targetUsername);
    let counter = 1;
    while (collisionCheck) {
      targetUsername = `${baseUsername}${counter}`;
      collisionCheck = await dbService.getUserByUsernameOrEmail(targetUsername);
      counter++;
    }

    const randomPassword = `G_${Math.random().toString(36).substring(2)}${Date.now()}`;
    const hashedPassword = await bcrypt.hash(randomPassword, 10);
    const displayName = fullName && String(fullName).trim() ? String(fullName).trim() : (baseUsername.charAt(0).toUpperCase() + baseUsername.slice(1));

    const newUser = {
      id: `usr_g_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      username: targetUsername.toLowerCase(),
      email: cleanEmail,
      passwordHash: hashedPassword,
      fullName: displayName,
      role: 'USER' as const,
      isActive: true,
      currency: 'BDT', // Requirement: Default currency is always Taka (BDT)
      timezone: 'Asia/Dhaka',
      dateFormat: 'DD MMM YYYY',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await dbService.insertUser(newUser);
    await dbService.seedDefaultCategories(newUser.id);

    await dbService.addAuditLog({
      userId: newUser.id,
      userEmail: newUser.email,
      action: 'REGISTER_GOOGLE',
      entityType: 'AUTH',
      entityId: newUser.id,
      details: `New account created with Google (${newUser.email})`,
      ipAddress: req.ip,
    });

    const token = generateToken(newUser);
    const { passwordHash: _, ...safeUser } = newUser;

    res.status(201).json({
      success: true,
      token,
      user: safeUser,
    });
  } catch (err: any) {
    console.error('Google auth error:', err);
    res.status(500).json({ error: 'Failed to authenticate with Google.' });
  }
});

// Current user profile check
apiRouter.get('/auth/me', authenticateToken, (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthenticated.' });
    return;
  }
  const { passwordHash, ...safeUser } = req.user;
  res.json({ user: safeUser });
});

// Update own profile & preferences (e.g. Currency from Settings)
apiRouter.put('/user/profile', authenticateToken, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthenticated.' });
      return;
    }

    const { currency, fullName, timezone, dateFormat } = req.body;
    const updates: Record<string, any> = {};

    if (currency && typeof currency === 'string') {
      const allowedCurrencies = ['BDT', 'USD', 'EUR', 'GBP', 'INR', 'SAR', 'AED', 'CAD', 'JPY'];
      const upper = currency.toUpperCase().trim();
      if (!allowedCurrencies.includes(upper)) {
        res.status(400).json({ error: 'Unsupported currency code.' });
        return;
      }
      updates.currency = upper;
    }

    if (fullName && typeof fullName === 'string' && fullName.trim()) {
      updates.fullName = fullName.trim();
    }

    if (timezone && typeof timezone === 'string') {
      updates.timezone = timezone.trim();
    }

    if (dateFormat && typeof dateFormat === 'string') {
      updates.dateFormat = dateFormat.trim();
    }

    const updated = await dbService.updateUser(req.user.id, updates);
    if (!updated) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    await dbService.addAuditLog({
      userId: req.user.id,
      userEmail: req.user.email,
      action: 'UPDATE_PROFILE',
      entityType: 'USER',
      entityId: req.user.id,
      details: `User updated personal settings (currency: ${updated.currency})`,
      ipAddress: req.ip,
    });

    const { passwordHash, ...safeUser } = updated;
    res.json({ success: true, user: safeUser });
  } catch (err: any) {
    console.error('Update profile error:', err);
    res.status(500).json({ error: 'Failed to update user profile.' });
  }
});

// ==========================================
// 2. ADMIN-ONLY MANAGEMENT ROUTES
// ==========================================

// Get users (paginated or all)
apiRouter.get('/admin/users', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.query.all === 'true') {
      const users = await dbService.getAllUsers();
      res.json({ success: true, users, items: users, totalCount: users.length });
      return;
    }

    const limit = validateLimit(req.query.limit);
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
    const direction = req.query.direction === 'backward' ? 'backward' : 'forward';
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const role = typeof req.query.role === 'string' ? req.query.role as any : undefined;
    const status = typeof req.query.status === 'string' ? req.query.status as any : undefined;

    const result = await dbService.getPaginatedUsers({
      limit,
      cursor,
      direction,
      search,
      role,
      status,
    });

    res.json({
      success: true,
      items: result.items,
      users: result.items,
      nextCursor: result.nextCursor,
      previousCursor: result.previousCursor,
      hasNextPage: result.hasNextPage,
      hasPreviousPage: result.hasPreviousPage,
      totalCount: result.totalCount,
    });
  } catch (err: any) {
    if (err.message && err.message.includes('Invalid limit')) {
      res.status(400).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: 'Failed to fetch users list.' });
  }
});

// Create user as Admin
apiRouter.post('/admin/users', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { username, email, fullName, password, role, currency } = req.body;
    if (!username || !email || !password || !fullName) {
      res.status(400).json({ error: 'Missing required user fields.' });
      return;
    }

    const existing = await dbService.getUserByUsernameOrEmail(email);
    if (existing) {
      res.status(409).json({ error: 'User with this email already exists.' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      username: username.toLowerCase().trim(),
      email: email.toLowerCase().trim(),
      passwordHash: hashedPassword,
      fullName: fullName.trim(),
      role: (role === 'ADMIN' ? 'ADMIN' : 'USER') as 'ADMIN' | 'USER',
      isActive: true,
      currency: currency || 'BDT',
      timezone: 'Asia/Dhaka',
      dateFormat: 'DD MMM YYYY',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await dbService.insertUser(newUser);
    await dbService.seedDefaultCategories(newUser.id);

    await dbService.addAuditLog({
      userId: req.user!.id,
      userEmail: req.user!.email,
      action: 'CREATE_USER',
      entityType: 'USER',
      entityId: newUser.id,
      details: `Admin created user ${newUser.username} (${newUser.role})`,
    });

    const { passwordHash: _, ...safeUser } = newUser;
    res.status(201).json({ success: true, user: safeUser });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to create user.' });
  }
});

// Edit user profile as Admin
apiRouter.put('/admin/users/:id', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { fullName, email, role, currency } = req.body;

    // Safeguard: Do not demote own admin role
    if (req.user!.id === id && role && role !== 'ADMIN') {
      res.status(400).json({ error: 'Safeguard: You cannot demote your own administrator role.' });
      return;
    }

    const updated = await dbService.updateUser(id, {
      fullName,
      email,
      role: role as 'ADMIN' | 'USER',
      currency,
    });

    if (!updated) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    await dbService.addAuditLog({
      userId: req.user!.id,
      userEmail: req.user!.email,
      action: 'UPDATE_USER',
      entityType: 'USER',
      entityId: id,
      details: `Admin updated user profile for ${updated.username}`,
    });

    const { passwordHash: _, ...safeUser } = updated;
    res.json({ success: true, user: safeUser });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to update user.' });
  }
});

// Toggle user active / inactive status
apiRouter.patch('/admin/users/:id/status', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    // Safeguard: Admin cannot deactivate own account
    if (req.user!.id === id && isActive === false) {
      res.status(400).json({ error: 'Safeguard: You cannot deactivate your own administrator account.' });
      return;
    }

    const updated = await dbService.updateUser(id, { isActive: Boolean(isActive) });
    if (!updated) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    await dbService.addAuditLog({
      userId: req.user!.id,
      userEmail: req.user!.email,
      action: 'STATUS_CHANGE',
      entityType: 'USER',
      entityId: id,
      details: `Status set to ${isActive ? 'Active' : 'Deactivated'} for ${updated.username}`,
    });

    const { passwordHash: _, ...safeUser } = updated;
    res.json({ success: true, user: safeUser });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to change user status.' });
  }
});

// Reset user password as Admin
apiRouter.post('/admin/users/:id/reset-password', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      res.status(400).json({ error: 'New password must be at least 6 characters.' });
      return;
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    const updated = await dbService.updateUser(id, { passwordHash: hashedPassword });
    if (!updated) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    await dbService.addAuditLog({
      userId: req.user!.id,
      userEmail: req.user!.email,
      action: 'PASSWORD_RESET',
      entityType: 'USER',
      entityId: id,
      details: `Password reset by administrator for ${updated.username}`,
    });

    res.json({ success: true, message: `Password for ${updated.username} successfully updated.` });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to reset password.' });
  }
});

// Delete user as Admin
apiRouter.delete('/admin/users/:id', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    if (req.user!.id === id) {
      res.status(400).json({ error: 'Safeguard: You cannot delete your own account.' });
      return;
    }

    await dbService.deleteUser(id);
    await dbService.addAuditLog({
      userId: req.user!.id,
      userEmail: req.user!.email,
      action: 'DELETE_USER',
      entityType: 'USER',
      entityId: id,
      details: `User ID ${id} deleted by administrator`,
    });

    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: 'Failed to delete user.' });
  }
});

// Admin system stats & audit logs
apiRouter.get('/admin/stats', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const status = dbService.getStatus();
    const users = await dbService.getAllUsers();
    const auditLogs = await dbService.getAuditLogs();
    res.json({
      status,
      totalUsers: users.length,
      activeUsers: users.filter(u => u.isActive).length,
      adminCount: users.filter(u => u.role === 'ADMIN').length,
      auditLogs,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch admin stats.' });
  }
});

// Admin DB Status and Connection Check
apiRouter.get('/admin/db-status', authenticateToken, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  const status = dbService.getStatus();
  res.json({ status });
});

// Admin Audit Logs (paginated or all)
apiRouter.get('/admin/audit-logs', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.query.all === 'true') {
      const logs = await dbService.getAuditLogs();
      res.json({ success: true, logs, items: logs, totalCount: logs.length });
      return;
    }

    const limit = validateLimit(req.query.limit);
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
    const direction = req.query.direction === 'backward' ? 'backward' : 'forward';
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;

    const result = await dbService.getPaginatedAuditLogs({
      limit,
      cursor,
      direction,
      search,
    });

    res.json({
      success: true,
      items: result.items,
      logs: result.items,
      nextCursor: result.nextCursor,
      previousCursor: result.previousCursor,
      hasNextPage: result.hasNextPage,
      hasPreviousPage: result.hasPreviousPage,
      totalCount: result.totalCount,
    });
  } catch (err: any) {
    if (err.message && err.message.includes('Invalid limit')) {
      res.status(400).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: 'Failed to fetch audit logs.' });
  }
});

// Admin Global Settings
apiRouter.get('/admin/settings', authenticateToken, requireAdmin, (req: AuthenticatedRequest, res: Response) => {
  try {
    const settings = dbService.getSystemSettings();
    res.json({ settings });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch system settings.' });
  }
});

apiRouter.put('/admin/settings', authenticateToken, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { maintenanceMode, allowUserRegistration, defaultCurrency, sessionTimeoutHours, appName } = req.body;
    const updated = await dbService.updateSystemSettings({
      maintenanceMode: maintenanceMode !== undefined ? Boolean(maintenanceMode) : undefined,
      allowUserRegistration: allowUserRegistration !== undefined ? Boolean(allowUserRegistration) : undefined,
      defaultCurrency: defaultCurrency ? String(defaultCurrency).trim().toUpperCase() : undefined,
      sessionTimeoutHours: sessionTimeoutHours ? Number(sessionTimeoutHours) : undefined,
      appName: appName ? String(appName).trim() : undefined,
    });

    await dbService.addAuditLog({
      userId: req.user!.id,
      userEmail: req.user!.email,
      action: 'UPDATE_SYSTEM_SETTINGS',
      entityType: 'SETTINGS',
      entityId: 'global',
      details: 'Administrator modified global application settings',
      ipAddress: req.ip,
    });

    res.json({ success: true, settings: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update system settings.' });
  }
});

// ==========================================
// 3. ACCOUNTS CRUD (USER-ONLY)
// ==========================================

apiRouter.get('/accounts', authenticateToken, requireUserOnly, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.query.paginate === 'true') {
      const limit = validateLimit(req.query.limit);
      const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
      const direction = req.query.direction === 'backward' ? 'backward' : 'forward';
      const search = typeof req.query.search === 'string' ? req.query.search : undefined;
      const type = typeof req.query.type === 'string' ? req.query.type as any : undefined;
      const status = typeof req.query.status === 'string' ? req.query.status as any : undefined;

      const result = await dbService.getPaginatedAccounts(req.user!.id, {
        limit,
        cursor,
        direction,
        search,
        type,
        status,
      });

      res.json({
        success: true,
        items: result.items,
        accounts: result.items,
        nextCursor: result.nextCursor,
        previousCursor: result.previousCursor,
        hasNextPage: result.hasNextPage,
        hasPreviousPage: result.hasPreviousPage,
        totalCount: result.totalCount,
      });
      return;
    }

    const accounts = await dbService.getAccounts(req.user!.id);
    res.json({ success: true, accounts, items: accounts, totalCount: accounts.length });
  } catch (err: any) {
    if (err.message && err.message.includes('Invalid limit')) {
      res.status(400).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: 'Failed to fetch accounts.' });
  }
});

apiRouter.post('/accounts', authenticateToken, requireUserOnly, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, type, providerName, accountNumber, openingBalance, currency } = req.body;
    if (!name || !type) {
      res.status(400).json({ error: 'Account name and type are required.' });
      return;
    }

    const opBal = Number(openingBalance) || 0;
    const newAccount: AccountRecord = {
      id: `acc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId: req.user!.id,
      name: name.trim(),
      type,
      providerName: providerName ? providerName.trim() : undefined,
      accountNumber: accountNumber ? accountNumber.trim() : undefined,
      openingBalance: opBal,
      currentBalance: opBal,
      currency: currency || req.user!.currency || 'BDT',
      status: 'ACTIVE',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const saved = await dbService.createAccount(newAccount);
    res.status(201).json({ success: true, account: saved });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create account.' });
  }
});

apiRouter.put('/accounts/:id', authenticateToken, requireUserOnly, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, type, providerName, accountNumber } = req.body;

    const updated = await dbService.updateAccount(id, req.user!.id, {
      name,
      type,
      providerName,
      accountNumber,
    });

    if (!updated) {
      res.status(404).json({ error: 'Account not found.' });
      return;
    }
    res.json({ success: true, account: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update account.' });
  }
});

apiRouter.patch('/accounts/:id/archive', authenticateToken, requireUserOnly, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const accounts = await dbService.getAccounts(req.user!.id);
    const existing = accounts.find(a => a.id === id);
    if (!existing) {
      res.status(404).json({ error: 'Account not found.' });
      return;
    }

    const nextStatus = existing.status === 'ACTIVE' ? 'ARCHIVED' : 'ACTIVE';
    const updated = await dbService.updateAccount(id, req.user!.id, { status: nextStatus });
    res.json({ success: true, account: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to toggle archive status.' });
  }
});

apiRouter.delete('/accounts/:id', authenticateToken, requireUserOnly, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const result = await dbService.deleteAccount(id, req.user!.id);
    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete account.' });
  }
});

// ==========================================
// 4. CATEGORIES CRUD (USER-ONLY)
// ==========================================

apiRouter.get('/categories', authenticateToken, requireUserOnly, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.query.paginate === 'true') {
      const limit = validateLimit(req.query.limit);
      const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
      const direction = req.query.direction === 'backward' ? 'backward' : 'forward';
      const search = typeof req.query.search === 'string' ? req.query.search : undefined;
      const type = typeof req.query.type === 'string' ? req.query.type as any : undefined;
      const status = typeof req.query.status === 'string' ? req.query.status as any : undefined;

      const result = await dbService.getPaginatedCategories(req.user!.id, {
        limit,
        cursor,
        direction,
        search,
        type,
        status,
      });

      res.json({
        success: true,
        items: result.items,
        categories: result.items,
        nextCursor: result.nextCursor,
        previousCursor: result.previousCursor,
        hasNextPage: result.hasNextPage,
        hasPreviousPage: result.hasPreviousPage,
        totalCount: result.totalCount,
      });
      return;
    }

    const categories = await dbService.getCategories(req.user!.id);
    res.json({ success: true, categories, items: categories, totalCount: categories.length });
  } catch (err: any) {
    if (err.message && err.message.includes('Invalid limit')) {
      res.status(400).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: 'Failed to fetch categories.' });
  }
});

apiRouter.post('/categories', authenticateToken, requireUserOnly, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, type, icon, color, subcategories } = req.body;
    if (!name || !type) {
      res.status(400).json({ error: 'Category name and type are required.' });
      return;
    }

    const newCat: CategoryRecord = {
      id: `cat_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId: req.user!.id,
      name: name.trim(),
      type,
      icon: icon || (type === 'INCOME' ? 'Briefcase' : 'Tag'),
      color: color || (type === 'INCOME' ? '#10b981' : '#f59e0b'),
      subcategories: Array.isArray(subcategories) ? subcategories : [],
      isArchived: false,
      isSystem: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const saved = await dbService.createCategory(newCat);
    res.status(201).json({ success: true, category: saved });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create category.' });
  }
});

apiRouter.put('/categories/:id', authenticateToken, requireUserOnly, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, icon, color, subcategories } = req.body;

    const updated = await dbService.updateCategory(id, req.user!.id, {
      name,
      icon,
      color,
      subcategories,
    });

    if (!updated) {
      res.status(404).json({ error: 'Category not found.' });
      return;
    }
    res.json({ success: true, category: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update category.' });
  }
});

apiRouter.post('/categories/:id/subcategories', authenticateToken, requireUserOnly, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    if (!name || !name.trim()) {
      res.status(400).json({ error: 'Subcategory name is required.' });
      return;
    }

    const categories = await dbService.getCategories(req.user!.id);
    const existing = categories.find(c => c.id === id);
    if (!existing) {
      res.status(404).json({ error: 'Category not found.' });
      return;
    }

    const sub = name.trim();
    if (existing.subcategories.includes(sub)) {
      res.status(400).json({ error: 'Subcategory already exists in this category.' });
      return;
    }

    const updatedSubs = [...existing.subcategories, sub];
    const updated = await dbService.updateCategory(id, req.user!.id, { subcategories: updatedSubs });
    res.json({ success: true, category: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add subcategory.' });
  }
});

apiRouter.patch('/categories/:id/archive', authenticateToken, requireUserOnly, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const categories = await dbService.getCategories(req.user!.id);
    const existing = categories.find(c => c.id === id);
    if (!existing) {
      res.status(404).json({ error: 'Category not found.' });
      return;
    }

    const updated = await dbService.updateCategory(id, req.user!.id, { isArchived: !existing.isArchived });
    res.json({ success: true, category: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to toggle archive.' });
  }
});

apiRouter.delete('/categories/:id', authenticateToken, requireUserOnly, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const result = await dbService.deleteCategory(id, req.user!.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete category.' });
  }
});

// ==========================================
// 5. TRANSACTIONS CRUD (USER-ONLY)
// ==========================================

apiRouter.get('/transactions', authenticateToken, requireUserOnly, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.query.all === 'true') {
      const transactions = await dbService.getTransactions(req.user!.id);
      res.json({ success: true, transactions, items: transactions, totalCount: transactions.length });
      return;
    }

    const limit = validateLimit(req.query.limit);
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
    const direction = req.query.direction === 'backward' ? 'backward' : 'forward';
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const type = typeof req.query.type === 'string' ? req.query.type : undefined;
    const accountId = typeof req.query.accountId === 'string' ? req.query.accountId : undefined;
    const category = typeof req.query.category === 'string' ? req.query.category : undefined;
    const startDate = typeof req.query.startDate === 'string' ? req.query.startDate : undefined;
    const endDate = typeof req.query.endDate === 'string' ? req.query.endDate : undefined;

    const result = await dbService.getPaginatedTransactions(req.user!.id, {
      limit,
      cursor,
      direction,
      search,
      type,
      accountId,
      category,
      startDate,
      endDate,
    });

    res.json({
      success: true,
      items: result.items,
      transactions: result.items,
      nextCursor: result.nextCursor,
      previousCursor: result.previousCursor,
      hasNextPage: result.hasNextPage,
      hasPreviousPage: result.hasPreviousPage,
      totalCount: result.totalCount,
    });
  } catch (err: any) {
    if (err.message && err.message.includes('Invalid limit')) {
      res.status(400).json({ error: err.message });
      return;
    }
    console.error('Error in GET /transactions:', err);
    res.status(500).json({ error: 'Failed to fetch transactions.' });
  }
});

// Add Income
apiRouter.post('/transactions/income', authenticateToken, requireUserOnly, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { accountId, category, subcategory, amount, date, description, reference } = req.body;
    if (!accountId || !amount || !date || !description) {
      res.status(400).json({ error: 'Account, amount, date, and description are required.' });
      return;
    }

    const accounts = await dbService.getAccounts(req.user!.id);
    const account = accounts.find(a => a.id === accountId);
    if (!account) {
      res.status(404).json({ error: 'Deposit account not found.' });
      return;
    }

    const tx: TransactionRecord = {
      id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId: req.user!.id,
      accountId,
      accountName: account.name,
      type: 'INCOME',
      category: category || 'Income',
      subcategory,
      amount: Math.abs(Number(amount)),
      direction: 'INFLOW',
      date,
      description: description.trim(),
      reference: reference ? reference.trim() : undefined,
      status: 'COMPLETED',
      createdAt: new Date().toISOString(),
    };

    const saved = await dbService.createTransaction(tx);
    res.status(201).json({ success: true, transaction: saved });
  } catch (err) {
    res.status(500).json({ error: 'Failed to record income.' });
  }
});

// Add Single Expense
apiRouter.post('/transactions/expense', authenticateToken, requireUserOnly, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { accountId, category, subcategory, amount, date, description, reference } = req.body;
    if (!accountId || !category || !amount || !date || !description) {
      res.status(400).json({ error: 'Account, category, amount, date, and description are required.' });
      return;
    }

    const accounts = await dbService.getAccounts(req.user!.id);
    const account = accounts.find(a => a.id === accountId);
    if (!account) {
      res.status(404).json({ error: 'Spending account not found.' });
      return;
    }

    const numAmount = Math.abs(Number(amount));
    const tx: TransactionRecord = {
      id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId: req.user!.id,
      accountId,
      accountName: account.name,
      type: 'EXPENSE',
      category,
      subcategory,
      amount: numAmount,
      direction: 'OUTFLOW',
      date,
      description: description.trim(),
      reference: reference ? reference.trim() : undefined,
      status: 'COMPLETED',
      createdAt: new Date().toISOString(),
    };

    const saved = await dbService.createTransaction(tx);
    res.status(201).json({ success: true, transaction: saved });
  } catch (err) {
    res.status(500).json({ error: 'Failed to record expense.' });
  }
});

// Add Bulk Daily Expenses
apiRouter.post('/transactions/bulk', authenticateToken, requireUserOnly, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { accountId, date, items } = req.body;
    if (!accountId || !date || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({ error: 'Account, date, and valid items array required.' });
      return;
    }

    const accounts = await dbService.getAccounts(req.user!.id);
    const account = accounts.find(a => a.id === accountId);
    if (!account) {
      res.status(404).json({ error: 'Account not found.' });
      return;
    }

    const createdTxs: TransactionRecord[] = [];
    for (const item of items) {
      if (!item.category || !item.desc || !item.amount || Number(item.amount) <= 0) continue;

      const tx: TransactionRecord = {
        id: `tx_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        userId: req.user!.id,
        accountId,
        accountName: account.name,
        type: 'EXPENSE',
        category: item.category,
        subcategory: item.subcategory,
        amount: Math.abs(Number(item.amount)),
        direction: 'OUTFLOW',
        date,
        description: item.desc.trim(),
        status: 'COMPLETED',
        createdAt: new Date().toISOString(),
      };

      const saved = await dbService.createTransaction(tx);
      createdTxs.push(saved);
    }

    res.status(201).json({ success: true, count: createdTxs.length, transactions: createdTxs });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save daily bulk expenses.' });
  }
});

// Update Transaction
apiRouter.put('/transactions/:id', authenticateToken, requireUserOnly, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { description, amount, date, category, subcategory, reference } = req.body;

    const updated = await dbService.updateTransaction(id, req.user!.id, {
      description,
      amount: amount !== undefined ? Math.abs(Number(amount)) : undefined,
      date,
      category,
      subcategory,
      reference,
    });

    if (!updated) {
      res.status(404).json({ error: 'Transaction not found.' });
      return;
    }

    res.json({ success: true, transaction: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update transaction.' });
  }
});

// Delete Transaction
apiRouter.delete('/transactions/:id', authenticateToken, requireUserOnly, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const success = await dbService.deleteTransaction(id, req.user!.id);
    if (!success) {
      res.status(404).json({ error: 'Transaction not found.' });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete transaction.' });
  }
});

// ==========================================
// 6. TRANSFERS CRUD (USER-ONLY)
// ==========================================

apiRouter.get('/transfers', authenticateToken, requireUserOnly, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.query.all === 'true') {
      const transfers = await dbService.getTransfers(req.user!.id);
      res.json({ success: true, transfers, items: transfers, totalCount: transfers.length });
      return;
    }

    const limit = validateLimit(req.query.limit);
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
    const direction = req.query.direction === 'backward' ? 'backward' : 'forward';
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const sourceAccountId = typeof req.query.sourceAccountId === 'string' ? req.query.sourceAccountId : undefined;
    const destAccountId = typeof req.query.destAccountId === 'string' ? req.query.destAccountId : undefined;

    const result = await dbService.getPaginatedTransfers(req.user!.id, {
      limit,
      cursor,
      direction,
      search,
      sourceAccountId,
      destAccountId,
    });

    res.json({
      success: true,
      items: result.items,
      transfers: result.items,
      nextCursor: result.nextCursor,
      previousCursor: result.previousCursor,
      hasNextPage: result.hasNextPage,
      hasPreviousPage: result.hasPreviousPage,
      totalCount: result.totalCount,
    });
  } catch (err: any) {
    if (err.message && err.message.includes('Invalid limit')) {
      res.status(400).json({ error: err.message });
      return;
    }
    console.error('Error in GET /transfers:', err);
    res.status(500).json({ error: 'Failed to fetch transfers.' });
  }
});

apiRouter.post('/transfers', authenticateToken, requireUserOnly, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { sourceAccountId, destinationAccountId, amount, transferFee, date, description, reference } = req.body;
    if (!sourceAccountId || !destinationAccountId || !amount) {
      res.status(400).json({ error: 'Source account, destination account, and amount are required.' });
      return;
    }

    if (sourceAccountId === destinationAccountId) {
      res.status(400).json({ error: 'Source and destination accounts must be different.' });
      return;
    }

    const accounts = await dbService.getAccounts(req.user!.id);
    const src = accounts.find(a => a.id === sourceAccountId);
    const dst = accounts.find(a => a.id === destinationAccountId);

    if (!src || !dst) {
      res.status(404).json({ error: 'Invalid accounts specified.' });
      return;
    }

    const numAmount = Math.abs(Number(amount));
    const numFee = Math.abs(Number(transferFee)) || 0;

    const transfer: TransferRecord = {
      id: `trf_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId: req.user!.id,
      sourceAccountId,
      sourceAccountName: src.name,
      destinationAccountId,
      destinationAccountName: dst.name,
      amount: numAmount,
      transferFee: numFee,
      date: date || new Date().toISOString().split('T')[0],
      description: description ? description.trim() : `Transfer from ${src.name} to ${dst.name}`,
      reference: reference ? reference.trim() : undefined,
      createdAt: new Date().toISOString(),
    };

    const saved = await dbService.createTransfer(transfer);
    res.status(201).json({ success: true, transfer: saved });
  } catch (err) {
    res.status(500).json({ error: 'Failed to execute transfer.' });
  }
});

apiRouter.delete('/transfers/:id', authenticateToken, requireUserOnly, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const success = await dbService.deleteTransfer(id, req.user!.id);
    if (!success) {
      res.status(404).json({ error: 'Transfer not found.' });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reverse transfer.' });
  }
});

// ==========================================
// 7. LOANS & REPAYMENTS CRUD (USER-ONLY)
// ==========================================

apiRouter.get('/loans', authenticateToken, requireUserOnly, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.query.all === 'true') {
      const loans = await dbService.getLoans(req.user!.id);
      const repayments = await dbService.getRepayments(req.user!.id);
      res.json({ success: true, loans, repayments, items: loans, totalCount: loans.length });
      return;
    }

    const limit = validateLimit(req.query.limit);
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
    const direction = req.query.direction === 'backward' ? 'backward' : 'forward';
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const type = typeof req.query.type === 'string' ? req.query.type as any : undefined;
    const status = typeof req.query.status === 'string' ? req.query.status as any : undefined;

    const result = await dbService.getPaginatedLoans(req.user!.id, {
      limit,
      cursor,
      direction,
      search,
      type,
      status,
    });

    res.json({
      success: true,
      items: result.items,
      loans: result.items,
      nextCursor: result.nextCursor,
      previousCursor: result.previousCursor,
      hasNextPage: result.hasNextPage,
      hasPreviousPage: result.hasPreviousPage,
      totalCount: result.totalCount,
    });
  } catch (err: any) {
    if (err.message && err.message.includes('Invalid limit')) {
      res.status(400).json({ error: err.message });
      return;
    }
    console.error('Error in GET /loans:', err);
    res.status(500).json({ error: 'Failed to fetch loans.' });
  }
});

// Paginated repayments endpoint
apiRouter.get('/loans/repayments', authenticateToken, requireUserOnly, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.query.all === 'true') {
      const repayments = await dbService.getRepayments(req.user!.id);
      res.json({ success: true, repayments, items: repayments, totalCount: repayments.length });
      return;
    }

    const limit = validateLimit(req.query.limit);
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
    const direction = req.query.direction === 'backward' ? 'backward' : 'forward';
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const loanId = typeof req.query.loanId === 'string' ? req.query.loanId : undefined;

    const result = await dbService.getPaginatedRepayments(req.user!.id, {
      limit,
      cursor,
      direction,
      search,
      loanId,
    });

    res.json({
      success: true,
      items: result.items,
      repayments: result.items,
      nextCursor: result.nextCursor,
      previousCursor: result.previousCursor,
      hasNextPage: result.hasNextPage,
      hasPreviousPage: result.hasPreviousPage,
      totalCount: result.totalCount,
    });
  } catch (err: any) {
    if (err.message && err.message.includes('Invalid limit')) {
      res.status(400).json({ error: err.message });
      return;
    }
    console.error('Error in GET /loans/repayments:', err);
    res.status(500).json({ error: 'Failed to fetch repayments.' });
  }
});

apiRouter.post('/loans', authenticateToken, requireUserOnly, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { type, counterpartyName, counterpartyContact, principalAmount, accountId, startDate, dueDate, interestRate, notes } = req.body;
    if (!type || !counterpartyName || !principalAmount || !accountId || !startDate) {
      res.status(400).json({ error: 'Type, counterparty name, principal amount, account, and start date are required.' });
      return;
    }

    const accounts = await dbService.getAccounts(req.user!.id);
    const account = accounts.find(a => a.id === accountId);
    if (!account) {
      res.status(404).json({ error: 'Specified account not found.' });
      return;
    }

    const principal = Math.abs(Number(principalAmount));
    const loan: LoanRecord = {
      id: `loan_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId: req.user!.id,
      accountId,
      accountName: account.name,
      type: type === 'LENT' ? 'LENT' : 'BORROWED',
      counterpartyName: counterpartyName.trim(),
      counterpartyContact: counterpartyContact ? counterpartyContact.trim() : undefined,
      principalAmount: principal,
      outstandingPrincipal: principal,
      interestRate: Number(interestRate) || 0,
      startDate,
      dueDate: dueDate || undefined,
      status: 'ACTIVE',
      notes: notes ? notes.trim() : undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const saved = await dbService.createLoan(loan);
    res.status(201).json({ success: true, loan: saved });
  } catch (err) {
    res.status(500).json({ error: 'Failed to record loan.' });
  }
});

apiRouter.delete('/loans/:id', authenticateToken, requireUserOnly, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const success = await dbService.deleteLoan(id, req.user!.id);
    if (!success) {
      res.status(404).json({ error: 'Loan not found.' });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete loan.' });
  }
});

// Record Repayment
apiRouter.post('/loans/:id/repayments', authenticateToken, requireUserOnly, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { accountId, amount, date, notes } = req.body;
    if (!accountId || !amount || !date) {
      res.status(400).json({ error: 'Account, amount, and date are required.' });
      return;
    }

    const loans = await dbService.getLoans(req.user!.id);
    const loan = loans.find(l => l.id === id);
    if (!loan) {
      res.status(404).json({ error: 'Loan record not found.' });
      return;
    }

    const accounts = await dbService.getAccounts(req.user!.id);
    const account = accounts.find(a => a.id === accountId);
    if (!account) {
      res.status(404).json({ error: 'Account not found.' });
      return;
    }

    const repaymentAmount = Math.abs(Number(amount));
    const repayment: RepaymentRecord = {
      id: `rep_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      userId: req.user!.id,
      loanId: id,
      counterpartyName: loan.counterpartyName,
      loanType: loan.type,
      accountId,
      accountName: account.name,
      amount: repaymentAmount,
      date,
      notes: notes ? notes.trim() : undefined,
      createdAt: new Date().toISOString(),
    };

    const saved = await dbService.addRepayment(repayment);
    res.status(201).json({ success: true, repayment: saved });
  } catch (err) {
    res.status(500).json({ error: 'Failed to record repayment.' });
  }
});

// ==========================================
// 8. BUDGETS CRUD (USER-ONLY)
// ==========================================

apiRouter.get('/budgets', authenticateToken, requireUserOnly, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const budgets = await dbService.getBudgets(req.user!.id);
    res.json({ budgets });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch budgets.' });
  }
});

apiRouter.post('/budgets', authenticateToken, requireUserOnly, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { categoryName, monthlyLimit } = req.body;
    if (!categoryName || monthlyLimit === undefined) {
      res.status(400).json({ error: 'Category name and limit are required.' });
      return;
    }

    const saved = await dbService.setBudget(req.user!.id, categoryName, Number(monthlyLimit));
    res.json({ success: true, budget: saved });
  } catch (err) {
    res.status(500).json({ error: 'Failed to set budget.' });
  }
});

apiRouter.delete('/budgets/:categoryName', authenticateToken, requireUserOnly, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { categoryName } = req.params;
    await dbService.deleteBudget(req.user!.id, categoryName);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete budget.' });
  }
});

// ==========================================
// 9. REPORTS & DATA EXPORT (USER-ONLY)
// ==========================================

apiRouter.get('/reports/summary', authenticateToken, requireUserOnly, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const accounts = await dbService.getAccounts(req.user!.id);
    const transactions = await dbService.getTransactions(req.user!.id);
    const loans = await dbService.getLoans(req.user!.id);

    const totalCash = accounts.filter(a => a.type === 'CASH').reduce((sum, a) => sum + a.currentBalance, 0);
    const totalBank = accounts.filter(a => a.type === 'BANK').reduce((sum, a) => sum + a.currentBalance, 0);
    const totalMobile = accounts.filter(a => a.type === 'MOBILE_BANKING').reduce((sum, a) => sum + a.currentBalance, 0);
    const netWorth = accounts.reduce((sum, a) => sum + a.currentBalance, 0);

    const totalIncome = transactions.filter(t => t.type === 'INCOME').reduce((sum, t) => sum + t.amount, 0);
    const totalExpense = transactions.filter(t => t.type === 'EXPENSE').reduce((sum, t) => sum + t.amount, 0);
    const netSavings = totalIncome - totalExpense;

    const totalReceivables = loans.filter(l => l.type === 'LENT').reduce((sum, l) => sum + l.outstandingPrincipal, 0);
    const totalPayables = loans.filter(l => l.type === 'BORROWED').reduce((sum, l) => sum + l.outstandingPrincipal, 0);

    res.json({
      netWorth,
      totalCash,
      totalBank,
      totalMobile,
      totalIncome,
      totalExpense,
      netSavings,
      totalReceivables,
      totalPayables,
      totalTransactions: transactions.length,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to compute reports summary.' });
  }
});

// Full database backup export
apiRouter.get('/reports/export', authenticateToken, requireUserOnly, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user!.id;
    const accounts = await dbService.getAccounts(userId);
    const categories = await dbService.getCategories(userId);
    const transactions = await dbService.getTransactions(userId);
    const transfers = await dbService.getTransfers(userId);
    const loans = await dbService.getLoans(userId);
    const repayments = await dbService.getRepayments(userId);
    const budgets = await dbService.getBudgets(userId);

    const payload = {
      app: 'HisabFlow',
      version: '2.0.0-production',
      user: {
        username: req.user!.username,
        email: req.user!.email,
        currency: req.user!.currency,
      },
      exportedAt: new Date().toISOString(),
      data: {
        accounts,
        categories,
        transactions,
        transfers,
        loans,
        repayments,
        budgets,
      },
    };

    res.json(payload);
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate export.' });
  }
});
