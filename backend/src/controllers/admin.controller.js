import { SUPPORTED_CURRENCIES } from '../config/preferences.js';
import { logger } from '../utils/logger.js';
import bcrypt from 'bcryptjs';
import { dbService } from '../services/db.service.js';
import { validateLimit } from '../utils/cursor.js';

const MIN_PASSWORD_LENGTH = 6;
const SHORT_PASSWORD = `Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`;
const cleanEmailOf = (email) => String(email).toLowerCase().trim();
const looksLikeEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export async function getUsers(req, res) {
  try {
    const limit = validateLimit(req.query.limit);
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
    const direction = req.query.direction === 'backward' ? 'backward' : 'forward';
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;
    const role = typeof req.query.role === 'string' ? req.query.role : undefined;
    const status = typeof req.query.status === 'string' ? req.query.status : undefined;

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
  } catch (err) {
    if (err.message && err.message.includes('Invalid limit')) {
      res.status(400).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: 'Failed to fetch users list.' });
  }
}

export async function createUser(req, res) {
  try {
    const { username, email, fullName, password, role, currency } = req.body;
    if (currency && !SUPPORTED_CURRENCIES.includes(currency)) {
      res.status(400).json({ error: 'Unsupported currency code.' });
      return;
    }
    if (!username || !email || !password || !fullName) {
      res.status(400).json({ error: 'Missing required user fields.' });
      return;
    }

    const cleanEmail = cleanEmailOf(email);
    if (!looksLikeEmail(cleanEmail)) {
      res.status(400).json({ error: 'Please enter a valid email address.' });
      return;
    }
    if (String(password).length < MIN_PASSWORD_LENGTH) {
      res.status(400).json({ error: SHORT_PASSWORD });
      return;
    }

    const existing = await dbService.getUserByUsernameOrEmail(cleanEmail);
    if (existing) {
      res.status(409).json({ error: 'User with this email already exists.' });
      return;
    }

    const cleanUsername = String(username).toLowerCase().trim();
    const existingName = await dbService.getUserByUsernameOrEmail(cleanUsername);
    if (existingName) {
      res.status(409).json({ error: 'Username is already taken.' });
      return;
    }

    const passwordHash = await bcrypt.hash(String(password), 10);
    const newUser = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      username: cleanUsername,
      email: cleanEmail,
      fullName: String(fullName).trim(),
      passwordHash,
      role: role === 'ADMIN' ? 'ADMIN' : 'USER',
      isActive: true,
      emailVerified: true,
      currency: currency || 'BDT',
      timezone: 'Asia/Dhaka',
      dateFormat: 'DD MMM YYYY',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await dbService.createUser(newUser);

    if (newUser.role === 'USER') {
      await dbService.seedDefaultCategories(newUser.id);
      await dbService.seedDefaultAccounts(newUser.id);
    }

    await dbService.addAuditLog({
      userId: req.user.id,
      userEmail: req.user.email,
      ipAddress: req.ip,
      action: 'CREATE_USER',
      entityType: 'USER',
      entityId: newUser.id,
      details: `Admin created user account for ${newUser.username} (${newUser.role})`,
    });

    const { passwordHash: _, ...safeUser } = newUser;
    res.status(201).json({ success: true, user: safeUser });
  } catch (err) {
    console.error('Admin create user error:', err);
    res.status(500).json({ error: 'Failed to create user.' });
  }
}

export async function updateUser(req, res) {
  try {
    const { id } = req.params;
    const { fullName, email, role, currency } = req.body;
    if (currency && !SUPPORTED_CURRENCIES.includes(currency)) {
      res.status(400).json({ error: 'Unsupported currency code.' });
      return;
    }

    if (role !== undefined && role !== 'ADMIN' && role !== 'USER') {
      res.status(400).json({ error: 'Role must be ADMIN or USER.' });
      return;
    }
    if (req.user.id === id && role && role !== 'ADMIN') {
      res.status(400).json({ error: 'Safeguard: You cannot demote your own administrator role.' });
      return;
    }

    const target = await dbService.getUserById(id);
    if (!target) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    // Only what was sent changes, so leaving out a field can never demote an admin or blank a value.
    const updates = {};
    if (fullName !== undefined) {
      if (!String(fullName).trim()) {
        res.status(400).json({ error: 'Full name cannot be empty.' });
        return;
      }
      updates.fullName = String(fullName).trim();
    }
    if (email !== undefined) {
      const cleanEmail = cleanEmailOf(email);
      if (!looksLikeEmail(cleanEmail)) {
        res.status(400).json({ error: 'Please enter a valid email address.' });
        return;
      }
      if (cleanEmail !== target.email) {
        const taken = await dbService.getUserByEmail(cleanEmail);
        if (taken && taken.id !== id) {
          res.status(409).json({ error: 'User with this email already exists.' });
          return;
        }
      }
      updates.email = cleanEmail;
    }
    if (role !== undefined) updates.role = role;
    if (currency !== undefined) updates.currency = currency;

    const updated = await dbService.updateUser(id, updates);

    if (!updated) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    const roleChange = role && role !== target.role ? `, role ${target.role} to ${role}` : '';
    await dbService.addAuditLog({
      userId: req.user.id,
      userEmail: req.user.email,
      ipAddress: req.ip,
      action: 'UPDATE_USER',
      entityType: 'USER',
      entityId: id,
      details: `Admin updated user profile for ${updated.username}${roleChange}`,
    });

    const { passwordHash: _, ...safeUser } = updated;
    res.json({ success: true, user: safeUser });
  } catch (err) {
    logger.error(`${req.method} ${req.baseUrl}${req.path} failed:`, err);
    res.status(500).json({ error: 'Failed to update user.' });
  }
}

export async function toggleUserStatus(req, res) {
  try {
    const { id } = req.params;
    let isActive = req.body.isActive;

    const user = await dbService.getUserById(id);
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    if (isActive === undefined) {
      isActive = !user.isActive;
    }

    if (req.user.id === id && isActive === false) {
      res.status(400).json({ error: 'Safeguard: You cannot deactivate your own administrator account.' });
      return;
    }

    const updated = await dbService.updateUser(id, { isActive: Boolean(isActive) });

    await dbService.addAuditLog({
      userId: req.user.id,
      userEmail: req.user.email,
      ipAddress: req.ip,
      action: isActive ? 'ACTIVATE_USER' : 'DEACTIVATE_USER',
      entityType: 'USER',
      entityId: id,
      details: `Admin changed status of ${user.username} to ${isActive ? 'Active' : 'Deactivated'}`,
    });

    const { passwordHash: _, ...safeUser } = updated;
    res.json({ success: true, user: safeUser });
  } catch (err) {
    logger.error(`${req.method} ${req.baseUrl}${req.path} failed:`, err);
    res.status(500).json({ error: 'Failed to change user status.' });
  }
}

export async function resetUserPassword(req, res) {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || String(newPassword).length < MIN_PASSWORD_LENGTH) {
      res.status(400).json({ error: SHORT_PASSWORD });
      return;
    }

    const user = await dbService.getUserById(id);
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    const passwordHash = await bcrypt.hash(String(newPassword), 10);
    await dbService.updateUser(id, { passwordHash });

    await dbService.addAuditLog({
      userId: req.user.id,
      userEmail: req.user.email,
      ipAddress: req.ip,
      action: 'RESET_PASSWORD',
      entityType: 'USER',
      entityId: id,
      details: `Admin reset password for user @${user.username}`,
    });

    res.json({ success: true, message: `Password reset successfully for @${user.username}.` });
  } catch (err) {
    logger.error(`${req.method} ${req.baseUrl}${req.path} failed:`, err);
    res.status(500).json({ error: 'Failed to reset user password.' });
  }
}

export async function deleteUser(req, res) {
  try {
    const { id } = req.params;

    if (req.user.id === id) {
      res.status(400).json({ error: 'Safeguard: You cannot delete your own administrator account.' });
      return;
    }

    const user = await dbService.getUserById(id);
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    await dbService.deleteUser(id);

    await dbService.addAuditLog({
      userId: req.user.id,
      userEmail: req.user.email,
      ipAddress: req.ip,
      action: 'DELETE_USER',
      entityType: 'USER',
      entityId: id,
      details: `Admin deleted user account @${user.username} (${user.email})`,
    });

    res.json({ success: true, message: `User @${user.username} deleted permanently.` });
  } catch (err) {
    logger.error(`${req.method} ${req.baseUrl}${req.path} failed:`, err);
    res.status(500).json({ error: 'Failed to delete user.' });
  }
}

export async function getStats(req, res) {
  try {
    const stats = await dbService.getAdminStats();
    res.json({ success: true, ...stats });
  } catch (err) {
    logger.error(`${req.method} ${req.baseUrl}${req.path} failed:`, err);
    res.status(500).json({ error: 'Failed to fetch admin stats.' });
  }
}

export function getDbStatus(req, res) {
  // The storage path is a server detail, so it stays out of the response.
  const { localDbFile: _, ...status } = dbService.getStatus();
  res.json({ success: true, ...status });
}

export async function getAuditLogs(req, res) {
  try {
    const limit = validateLimit(req.query.limit);
    const cursor = typeof req.query.cursor === 'string' ? req.query.cursor : undefined;
    const direction = req.query.direction === 'backward' ? 'backward' : 'forward';
    const action = typeof req.query.action === 'string' ? req.query.action : undefined;
    const search = typeof req.query.search === 'string' ? req.query.search : undefined;

    const result = await dbService.getPaginatedAuditLogs({
      limit,
      cursor,
      direction,
      action,
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
  } catch (err) {
    if (err.message && err.message.includes('Invalid limit')) {
      res.status(400).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: 'Failed to fetch audit logs.' });
  }
}

export async function getSettings(req, res) {
  try {
    res.json({ success: true, settings: await dbService.getSystemSettings() });
  } catch (err) {
    logger.error(`${req.method} ${req.baseUrl}${req.path} failed:`, err);
    res.status(500).json({ error: 'Failed to fetch system settings.' });
  }
}

export async function updateSettings(req, res) {
  try {
    const { allowUserRegistration, defaultCurrency } = req.body;
    const updates = {};
    if (allowUserRegistration !== undefined) {
      if (typeof allowUserRegistration !== 'boolean') {
        res.status(400).json({ error: 'Public registration must be on or off.' });
        return;
      }
      updates.allowUserRegistration = allowUserRegistration;
    }
    if (defaultCurrency !== undefined) {
      if (!SUPPORTED_CURRENCIES.includes(defaultCurrency)) {
        res.status(400).json({ error: 'Unsupported currency code.' });
        return;
      }
      updates.defaultCurrency = defaultCurrency;
    }
    const updated = await dbService.updateSystemSettings(updates);

    await dbService.addAuditLog({
      userId: req.user.id,
      userEmail: req.user.email,
      ipAddress: req.ip,
      action: 'UPDATE_SETTINGS',
      entityType: 'SETTINGS',
      entityId: 'system_settings',
      details: 'System settings updated by administrator',
    });

    res.json({ success: true, settings: updated });
  } catch (err) {
    logger.error(`${req.method} ${req.baseUrl}${req.path} failed:`, err);
    res.status(500).json({ error: 'Failed to update system settings.' });
  }
}
