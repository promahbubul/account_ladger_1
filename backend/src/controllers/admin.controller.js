import bcrypt from 'bcryptjs';
import { dbService } from '../services/db.service.js';
import { validateLimit } from '../utils/cursor.js';

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
    if (!username || !email || !password || !fullName) {
      res.status(400).json({ error: 'Missing required user fields.' });
      return;
    }

    const existing = await dbService.getUserByUsernameOrEmail(email);
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
      email: String(email).toLowerCase().trim(),
      fullName: String(fullName).trim(),
      passwordHash,
      role: role === 'ADMIN' ? 'ADMIN' : 'USER',
      isActive: true,
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

    if (req.user.id === id && role && role !== 'ADMIN') {
      res.status(400).json({ error: 'Safeguard: You cannot demote your own administrator role.' });
      return;
    }

    const updated = await dbService.updateUser(id, {
      fullName,
      email,
      role: role === 'ADMIN' ? 'ADMIN' : 'USER',
      currency,
    });

    if (!updated) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    await dbService.addAuditLog({
      userId: req.user.id,
      userEmail: req.user.email,
      action: 'UPDATE_USER',
      entityType: 'USER',
      entityId: id,
      details: `Admin updated user profile for ${updated.username}`,
    });

    const { passwordHash: _, ...safeUser } = updated;
    res.json({ success: true, user: safeUser });
  } catch (err) {
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
      action: isActive ? 'ACTIVATE_USER' : 'DEACTIVATE_USER',
      entityType: 'USER',
      entityId: id,
      details: `Admin changed status of ${user.username} to ${isActive ? 'Active' : 'Deactivated'}`,
    });

    const { passwordHash: _, ...safeUser } = updated;
    res.json({ success: true, user: safeUser });
  } catch (err) {
    res.status(500).json({ error: 'Failed to change user status.' });
  }
}

export async function resetUserPassword(req, res) {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || String(newPassword).length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters long.' });
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
      action: 'RESET_PASSWORD',
      entityType: 'USER',
      entityId: id,
      details: `Admin reset password for user @${user.username}`,
    });

    res.json({ success: true, message: `Password reset successfully for @${user.username}.` });
  } catch (err) {
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
      action: 'DELETE_USER',
      entityType: 'USER',
      entityId: id,
      details: `Admin deleted user account @${user.username} (${user.email})`,
    });

    res.json({ success: true, message: `User @${user.username} deleted permanently.` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete user.' });
  }
}

export async function getStats(req, res) {
  try {
    const stats = await dbService.getAdminStats();
    const status = dbService.getStatus();
    res.json({
      success: true,
      ...stats,
      status: {
        connectedToNeon: Boolean(status.connectedToNeon),
        connectedToPostgres: Boolean(status.connectedToPostgres),
        storageFile: status.localDbFile || 'hisabflow_db.json',
        transactionCount: stats.totalUsers || 0,
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch admin stats.' });
  }
}

export function getDbStatus(req, res) {
  const status = dbService.getStatus();
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

export function getSettings(req, res) {
  const settings = dbService.getSystemSettings();
  res.json({ success: true, settings });
}

export async function updateSettings(req, res) {
  try {
    const updates = req.body;
    const updated = await dbService.updateSystemSettings(updates);

    await dbService.addAuditLog({
      userId: req.user.id,
      userEmail: req.user.email,
      action: 'UPDATE_SETTINGS',
      entityType: 'SETTINGS',
      entityId: 'system_settings',
      details: 'System settings updated by administrator',
    });

    res.json({ success: true, settings: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update system settings.' });
  }
}
