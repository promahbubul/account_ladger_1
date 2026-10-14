import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { dbService, UserRecord } from './db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'hisabflow-secure-jwt-secret-key-neon-db';

export interface AuthenticatedRequest extends Request {
  user?: UserRecord;
}

export function generateToken(user: UserRecord): string {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
    },
    JWT_SECRET,
    { expiresIn: '30d' }
  );
}

export async function authenticateToken(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    res.status(401).json({ error: 'Access token required. Please sign in.' });
    return;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as { id: string; email: string };
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
    return;
  }
}

export function requireAdmin(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.user || req.user.role !== 'ADMIN') {
    res.status(403).json({ error: 'Access denied: Administrator privileges required.' });
    return;
  }
  next();
}

export function requireUserOnly(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
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
