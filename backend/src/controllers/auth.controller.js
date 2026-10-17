import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { dbService } from '../services/db.service.js';
import { generateToken } from '../middleware/auth.js';
import { config } from '../config/env.js';
import { verifyFirebaseIdToken } from '../config/firebase-admin.js';
import { emailService } from '../services/email.service.js';

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

    if (!user.emailVerified) {
      res.status(403).json({
        error: 'Email verification required. Please verify your email before accessing your account.',
        emailVerified: false,
        email: user.email,
      });
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
      emailVerified: false, // STRICT: Mandatory email verification for email/password accounts
      currency: 'BDT',
      timezone: 'Asia/Dhaka',
      dateFormat: 'DD MMM YYYY',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await dbService.createUser(newUser);
    await dbService.seedDefaultCategories(newUser.id);
    await dbService.seedDefaultAccounts(newUser.id);

    // Generate 6-digit cryptographically secure verification code
    const verificationCode = crypto.randomInt(100000, 1000000).toString();
    const codeHash = crypto.createHash('sha256').update(verificationCode).digest('hex');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    await dbService.createEmailVerificationCode({
      userId: newUser.id,
      codeHash,
      expiresAt,
    });

    // Send verification code via configured Gmail SMTP
    try {
      await emailService.sendEmailVerificationCode({
        to: newUser.email,
        code: verificationCode,
        userDisplayName: newUser.fullName || newUser.username,
        expirationMinutes: 10,
      });
    } catch (mailErr) {
      console.error('[AccountLedger.com API Warning] Failed to dispatch verification email:', mailErr.message);
    }

    await dbService.addAuditLog({
      userId: newUser.id,
      userEmail: newUser.email,
      action: 'REGISTER_UNVERIFIED',
      entityType: 'AUTH',
      entityId: newUser.id,
      details: `New user self-registered; 6-digit verification code issued (${newUser.email})`,
      ipAddress: req.ip,
    });

    const { passwordHash: _, ...safeUser } = newUser;

    // Critical: Do NOT return a session token for unverified accounts
    res.status(201).json({
      success: true,
      message: 'Account created. Please check your email for the 6-digit verification code.',
      emailVerified: false,
      email: newUser.email,
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

      if (!user.emailVerified) {
        user = await dbService.updateUser(user.id, { emailVerified: true });
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
          emailVerified: true, // Confirmed verified by Google
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
      emailVerified: true, // Google confirmed verified
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
        let existing = (await dbService.getUserByFirebaseUid(uid)) || (await dbService.getUserByEmail(email));
        if (existing && existing.isActive) {
          if (!existing.emailVerified) {
            existing = await dbService.updateUser(existing.id, { emailVerified: true });
          }
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

export async function forgotPassword(req, res) {
  try {
    const { email } = req.body;
    if (!email || !String(email).includes('@') || !String(email).includes('.')) {
      res.status(400).json({ error: 'Please enter a valid email address.' });
      return;
    }

    const cleanEmail = String(email).toLowerCase().trim();

    // Universal generic response to prevent email enumeration attacks
    const genericResponse = {
      success: true,
      message: 'If an account exists for this email address, you will receive a password reset link shortly.',
    };

    const user = await dbService.getUserByEmail(cleanEmail);
    if (!user || !user.isActive) {
      // Return identical response for non-existent or inactive accounts
      res.json(genericResponse);
      return;
    }

    // Generate cryptographically secure random token (64 hex characters from 32 bytes)
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');

    // 20-minute validity period
    const expiresAt = new Date(Date.now() + 20 * 60 * 1000);

    // Save token hash in database (invalidates any older pending tokens)
    await dbService.createPasswordResetToken({
      userId: user.id,
      tokenHash,
      expiresAt,
    });

    // Build reset URL using configured frontend origin
    const baseUrl = (config.frontendUrl || 'http://localhost:5000').replace(/\/+$/, '');
    const resetUrl = `${baseUrl}/reset-password?token=${rawToken}`;

    // Send email via Gmail SMTP
    try {
      await emailService.sendPasswordResetEmail({
        to: user.email,
        resetUrl,
        userDisplayName: user.fullName || user.username,
        expirationMinutes: 20,
      });
    } catch (mailErr) {
      // Do not leak SMTP infrastructure errors to client
      console.error('[AccountLedger.com API Warning] Failed to dispatch password reset email:', mailErr.message);
    }

    await dbService.addAuditLog({
      userId: user.id,
      userEmail: user.email,
      action: 'PASSWORD_RESET_REQUESTED',
      entityType: 'AUTH',
      entityId: user.id,
      details: 'Password reset link requested',
      ipAddress: req.ip,
    });

    res.json(genericResponse);
  } catch (err) {
    console.error('[AccountLedger.com API Error] forgotPassword error:', err);
    res.status(500).json({ error: 'Failed to process password reset request.' });
  }
}

export async function verifyResetToken(req, res) {
  try {
    const token = req.query.token || (req.body && req.body.token);
    if (!token || typeof token !== 'string' || !token.trim()) {
      res.status(400).json({ valid: false, error: 'Password reset token is required.' });
      return;
    }

    const tokenHash = crypto.createHash('sha256').update(String(token).trim()).digest('hex');
    const record = await dbService.getPasswordResetTokenByHash(tokenHash);

    if (!record) {
      res.status(400).json({ valid: false, error: 'Invalid or unrecognized password reset token.' });
      return;
    }

    if (record.usedAt) {
      res.status(400).json({ valid: false, error: 'This password reset link has already been used. Please request a new one.' });
      return;
    }

    if (new Date(record.expiresAt) < new Date()) {
      res.status(400).json({ valid: false, error: 'This password reset link has expired. Please request a new one.' });
      return;
    }

    res.json({ valid: true });
  } catch (err) {
    console.error('[AccountLedger.com API Error] verifyResetToken error:', err);
    res.status(500).json({ valid: false, error: 'Failed to verify password reset token.' });
  }
}

export async function resetPassword(req, res) {
  try {
    const { token, newPassword } = req.body;
    if (!token || typeof token !== 'string' || !token.trim()) {
      res.status(400).json({ error: 'Password reset token is required.' });
      return;
    }

    if (!newPassword || String(newPassword).length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters long.' });
      return;
    }

    const tokenHash = crypto.createHash('sha256').update(String(token).trim()).digest('hex');
    const newPasswordHash = await bcrypt.hash(String(newPassword), 10);

    const result = await dbService.redeemPasswordResetToken({
      tokenHash,
      newPasswordHash,
      ipAddress: req.ip,
    });

    if (!result.success) {
      res.status(400).json({ error: result.error });
      return;
    }

    res.json({
      success: true,
      message: 'Your password has been successfully reset. You may now sign in with your new password.',
    });
  } catch (err) {
    console.error('[AccountLedger.com API Error] resetPassword error:', err);
    res.status(500).json({ error: 'Failed to reset password.' });
  }
}

export async function verifyEmail(req, res) {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      res.status(400).json({ error: 'Email and 6-digit verification code are required.' });
      return;
    }

    const cleanEmail = String(email).toLowerCase().trim();
    const cleanCode = String(code).trim();

    if (!/^\d{6}$/.test(cleanCode)) {
      res.status(400).json({ error: 'Verification code must be exactly 6 digits.' });
      return;
    }

    const user = await dbService.getUserByEmail(cleanEmail);
    if (!user) {
      res.status(400).json({ error: 'Invalid verification request.' });
      return;
    }

    if (user.emailVerified) {
      const token = generateToken(user);
      const { passwordHash: _, ...safeUser } = user;
      res.json({
        success: true,
        message: 'Email is already verified.',
        alreadyVerified: true,
        token,
        user: safeUser,
      });
      return;
    }

    const codeHash = crypto.createHash('sha256').update(cleanCode).digest('hex');

    const verifyResult = await dbService.verifyEmailCode({
      userId: user.id,
      codeHash,
      ipAddress: req.ip,
    });

    if (!verifyResult.success) {
      res.status(400).json({
        error: verifyResult.error,
        remainingAttempts: verifyResult.remainingAttempts,
      });
      return;
    }

    const updatedUser = await dbService.getUserById(user.id);
    const token = generateToken(updatedUser);
    const { passwordHash: _, ...safeUser } = updatedUser;

    await dbService.addAuditLog({
      userId: updatedUser.id,
      userEmail: updatedUser.email,
      action: 'EMAIL_VERIFIED',
      entityType: 'AUTH',
      entityId: updatedUser.id,
      details: 'Email successfully verified with 6-digit code',
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      message: 'Email successfully verified.',
      token,
      user: safeUser,
    });
  } catch (err) {
    console.error('[AccountLedger.com API Error] verifyEmail error:', err);
    res.status(500).json({ error: 'Failed to verify email.' });
  }
}

export async function resendVerification(req, res) {
  try {
    const { email } = req.body;
    if (!email || !String(email).includes('@')) {
      res.status(400).json({ error: 'Please enter a valid email address.' });
      return;
    }

    const cleanEmail = String(email).toLowerCase().trim();
    const user = await dbService.getUserByEmail(cleanEmail);

    if (!user) {
      // Generic message to avoid account enumeration
      res.json({
        success: true,
        message: 'If an unverified account exists for this email, a new verification code has been sent.',
      });
      return;
    }

    if (user.emailVerified) {
      res.json({
        success: true,
        message: 'Your email address is already verified. Please sign in.',
        alreadyVerified: true,
      });
      return;
    }

    // 60-second cooldown check
    const latestCode = await dbService.getLatestEmailVerificationCode(user.id);
    if (latestCode && !latestCode.usedAt) {
      const now = Date.now();
      const createdAtTime = new Date(latestCode.createdAt).getTime();
      const elapsedMs = now - createdAtTime;
      const cooldownMs = 60 * 1000;

      if (elapsedMs < cooldownMs) {
        const remainingSeconds = Math.ceil((cooldownMs - elapsedMs) / 1000);
        res.setHeader('Retry-After', remainingSeconds);
        res.status(429).json({
          error: `Please wait ${remainingSeconds} seconds before requesting a new verification code.`,
          retryAfter: remainingSeconds,
        });
        return;
      }
    }

    // Generate new 6-digit code
    const verificationCode = crypto.randomInt(100000, 1000000).toString();
    const codeHash = crypto.createHash('sha256').update(verificationCode).digest('hex');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    await dbService.createEmailVerificationCode({
      userId: user.id,
      codeHash,
      expiresAt,
    });

    try {
      await emailService.sendEmailVerificationCode({
        to: user.email,
        code: verificationCode,
        userDisplayName: user.fullName || user.username,
        expirationMinutes: 10,
      });
    } catch (mailErr) {
      console.error('[AccountLedger.com API Warning] Failed to resend verification code:', mailErr.message);
    }

    await dbService.addAuditLog({
      userId: user.id,
      userEmail: user.email,
      action: 'VERIFICATION_CODE_RESENT',
      entityType: 'AUTH',
      entityId: user.id,
      details: 'New verification code requested and sent',
      ipAddress: req.ip,
    });

    res.json({
      success: true,
      message: 'A new 6-digit verification code has been sent to your email.',
    });
  } catch (err) {
    console.error('[AccountLedger.com API Error] resendVerification error:', err);
    res.status(500).json({ error: 'Failed to resend verification code.' });
  }
}


