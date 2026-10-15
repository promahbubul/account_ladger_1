import jwt from 'jsonwebtoken';
import { dbService } from '../services/db.service.js';
import { config } from '../config/env.js';

export function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
    },
    config.jwtSecret,
    { expiresIn: '30d' }
  );
}

export async function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    res.status(401).json({ error: 'Access token required. Please sign in.' });
    return;
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret);
    const user = await dbService.getUserById(payload.id);

    if (!user) {
      res.status(401).json({ error: 'User account not found.' });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({ error: 'Account is deactivated. Contact system administrator.' });
      return;
    }

    req.user = user;
    next();
  } catch (err) {
    res.status(403).json({ error: 'Invalid or expired session. Please sign in again.' });
  }
}

export function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'ADMIN') {
    res.status(403).json({ error: 'Access denied: Administrator privileges required.' });
    return;
  }
  next();
}

export function requireUserOnly(req, res, next) {
  if (!req.user) {
    res.status(401).json({ error: 'Access token required. Please sign in.' });
    return;
  }
  if (req.user.role === 'ADMIN') {
    res.status(403).json({
      error: 'Access denied: System administrators do not have personal financial accounts and cannot access user financial records.',
    });
    return;
  }
  next();
}
