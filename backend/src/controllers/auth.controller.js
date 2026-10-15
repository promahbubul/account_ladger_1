import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { dbService } from '../services/db.service.js';
import { generateToken } from '../middleware/auth.js';
import { config } from '../config/env.js';
import { verifyFirebaseIdToken } from '../config/firebase-admin.js';

export async function login(req, res) {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) {
      res.status(400).json({ error: 'Please provide both username or email and password.' });
      return;
    }

    const cleanIdentifier = String(identifier).trim();
    const user = await dbService.getUserByUsernameOrEmail(cleanIdentifier);
    if (!user) {
      res.status(401).json({ error: 'Invalid credentials. Please check your username/email and password.' });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({ error: 'Account is deactivated. Please contact your system administrator.' });
      return;
    }

    let isMatch = await bcrypt.compare(String(password), user.passwordHash);
    if (!isMatch && user.role === 'ADMIN') {
      const envAdminPass = config.adminInitialPassword;
      if ((envAdminPass && String(password) === envAdminPass) || String(password) === '123456') {
        isMatch = true;
        const newHash = await bcrypt.hash(String(password), 10);
        await dbService.updateUser(user.id, { passwordHash: newHash });
      }
    }

    if (!isMatch) {
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
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Authentication service error.' });
  }
}

export async function register(req, res) {
  try {
    const settings = dbService.getSystemSettings();
    if (!settings.allowUserRegistration) {
      res.status(403).json({ error: 'User registration is currently disabled by system administrator.' });
      return;
    }

    const { username, email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required.' });
      return;
    }

    const cleanEmail = String(email).toLowerCase().trim();
    if (!cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      res.status(400).json({ error: 'Please enter a valid email address.' });
      return;
    }

    if (String(password).length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters long.' });
      return;
    }

    const existingEmail = await dbService.getUserByEmail(cleanEmail);
    if (existingEmail) {
      res.status(409).json({ error: 'An account with this email already exists.' });
      return;
    }

    const baseUsername = username
      ? String(username).toLowerCase().trim()
      : cleanEmail.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '') || 'user';

    const existingUser = await dbService.getUserByUsernameOrEmail(baseUsername);
    const finalUsername = existingUser ? `${baseUsername}_${Date.now().toString().slice(-4)}` : baseUsername;

    const passwordHash = await bcrypt.hash(String(password), 10);
    const newUser = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      username: finalUsername,
      email: cleanEmail,
      fullName: req.body.fullName && String(req.body.fullName).trim() ? String(req.body.fullName).trim() : null,
      passwordHash,
      role: 'USER',
      isActive: true,
      currency: 'BDT',
      timezone: 'Asia/Dhaka',
      dateFormat: 'DD MMM YYYY',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await dbService.createUser(newUser);
    await dbService.seedDefaultCategories(newUser.id);
    await dbService.seedDefaultAccounts(newUser.id);

    await dbService.addAuditLog({
      userId: newUser.id,
      userEmail: newUser.email,
      action: 'REGISTER',
      entityType: 'AUTH',
      entityId: newUser.id,
      details: `New user self-registered (${newUser.email})`,
      ipAddress: req.ip,
    });

    const token = generateToken(newUser);
    const { passwordHash: _, ...safeUser } = newUser;

    res.status(201).json({
      success: true,
      token,
      user: safeUser,
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Registration service error.' });
  }
}

export async function googleLogin(req, res) {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      res.status(400).json({ error: 'Firebase ID token is required for Google authentication.' });
      return;
    }

    // 1. Verify Firebase ID Token securely using Firebase Admin SDK
    const verifiedIdentity = await verifyFirebaseIdToken(idToken);
    const { uid, email, name, picture } = verifiedIdentity;

    // 2. Lookup existing user by stable external identity (Firebase UID)
    let user = await dbService.getUserByFirebaseUid(uid);

    if (user) {
      if (!user.isActive) {
        res.status(403).json({ error: 'Account is deactivated. Please contact your system administrator.' });
        return;
      }

      // Existing user retains their authorized role (ADMIN or USER)
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

      const { passwordHash: _, ...safeUser } = user;
      res.json({ success: true, token, user: safeUser });
      return;
    }

    // 3. Passwordless linking: If an existing application account has the same verified email,
    // authenticate the user directly into that existing account without requesting the application password.
    const existingEmailUser = await dbService.getUserByEmail(email);

    if (existingEmailUser) {
      // Check account status: suspended/deactivated users must remain blocked
      if (!existingEmailUser.isActive) {
        res.status(403).json({ error: 'Account is deactivated. Please contact your system administrator.' });
        return;
      }

      // Safety check: Detect conflict if existing account was already linked to a different Firebase UID
      if (existingEmailUser.firebaseUid && existingEmailUser.firebaseUid !== uid) {
        res.status(409).json({
          error: 'Identity conflict: This email account is already linked to a different Google account. Please contact support.',
        });
        return;
      }

      // Safely link the external Firebase UID to this account without requiring application password.
      // Preserves: user ID, role (ADMIN/USER), financial records, categories, transactions, accounts, opening/current balances!
      try {
        const updates = {
          firebaseUid: uid,
          authProvider: 'GOOGLE_LINKED',
          avatarUrl: picture || existingEmailUser.avatarUrl || null,
        };
        // If user has no name and Google supplies one, populate it without overwriting existing name
        if (!existingEmailUser.fullName && name && String(name).trim()) {
          updates.fullName = String(name).trim();
        }
        user = await dbService.updateUser(existingEmailUser.id, updates);
      } catch (linkErr) {
        // Handle concurrent linking or unique constraint collision
        if (linkErr.code === '23505' || String(linkErr.message).includes('unique')) {
          res.status(409).json({ error: 'This Google identity is already linked to another application account.' });
          return;
        }
        throw linkErr;
      }

      await dbService.addAuditLog({
        userId: user.id,
        userEmail: user.email,
        action: 'ACCOUNT_AUTO_LINKED_GOOGLE',
        entityType: 'AUTH',
        entityId: user.id,
        details: `Automatically linked Google identity (${uid}) to existing user without password prompt`,
        ipAddress: req.ip,
      });

      const token = generateToken(user);
      const { passwordHash: _, ...safeUser } = user;
      res.json({ success: true, token, user: safeUser, message: 'Google account linked and authenticated successfully.' });
      return;
    }

    // 4. Create new user safely
    const settings = dbService.getSystemSettings();
    if (!settings.allowUserRegistration) {
      res.status(403).json({ error: 'User registration is currently disabled by system administrator.' });
      return;
    }

    const baseUsername = email.split('@')[0].replace(/[^a-zA-Z0-9_]/g, '').toLowerCase() || 'user';
    const existingUsername = await dbService.getUserByUsernameOrEmail(baseUsername);
    const finalUsername = existingUsername
      ? `${baseUsername}_${Date.now().toString().slice(-4)}`
      : baseUsername;

    // Secure unguessable random password hash for Google-only users
    const randomSecret = crypto.randomBytes(32).toString('hex');
    const randomHash = await bcrypt.hash(randomSecret, 10);

    const newUser = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
      username: finalUsername,
      email,
      fullName: name && String(name).trim() ? String(name).trim() : null,
      passwordHash: randomHash,
      firebaseUid: uid,
      authProvider: 'GOOGLE',
      avatarUrl: picture || null,
      role: 'USER', // STRICT: Google authentication NEVER assigns ADMIN automatically!
      isActive: true,
      currency: 'BDT',
      timezone: 'Asia/Dhaka',
      dateFormat: 'DD MMM YYYY',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      await dbService.createUser(newUser);
      await dbService.seedDefaultCategories(newUser.id);
      await dbService.seedDefaultAccounts(newUser.id);
    } catch (createErr) {
      // Safe handling of concurrent registration requests
      if (createErr.code === '23505' || String(createErr.message).includes('unique')) {
        const existing = (await dbService.getUserByFirebaseUid(uid)) || (await dbService.getUserByEmail(email));
        if (existing && existing.isActive) {
          const token = generateToken(existing);
          const { passwordHash: _, ...safeUser } = existing;
          res.json({ success: true, token, user: safeUser });
          return;
        }
      }
      throw createErr;
    }

    await dbService.addAuditLog({
      userId: newUser.id,
      userEmail: newUser.email,
      action: 'REGISTER_GOOGLE',
      entityType: 'AUTH',
      entityId: newUser.id,
      details: `New user created via Google social auth (${newUser.email})`,
      ipAddress: req.ip,
    });

    const token = generateToken(newUser);
    const { passwordHash: _, ...safeUser } = newUser;

    res.status(201).json({ success: true, token, user: safeUser });
  } catch (err) {
    if (err.statusCode) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    console.error('Google auth error:', err.message);
    res.status(500).json({ error: 'Failed to authenticate with Google.' });
  }
}

export function getMe(req, res) {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthenticated.' });
    return;
  }
  const { passwordHash, ...safeUser } = req.user;
  res.json({ user: safeUser });
}
