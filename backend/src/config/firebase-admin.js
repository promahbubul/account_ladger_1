import { initializeApp, getApps, getApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import fs from 'fs';
import { logger } from '../utils/logger.js';

let firebaseAdminApp = null;
const EXPECTED_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || 'account-ladger01';

/**
 * Initializes Firebase Admin exactly once.
 * Supports:
 * 1. GOOGLE_APPLICATION_CREDENTIALS file path
 * 2. FIREBASE_SERVICE_ACCOUNT_KEY JSON string
 * 3. Individual env vars (FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY)
 * 4. Application Default Credentials / Project ID fallback for token verification using Google's public keys.
 */
export function getFirebaseAdmin() {
  if (firebaseAdminApp) {
    return firebaseAdminApp;
  }

  const existingApps = getApps();
  if (existingApps.length > 0) {
    firebaseAdminApp = existingApps[0];
    return firebaseAdminApp;
  }

  try {
    let credential = null;

    // 1. Explicit Service Account JSON string in environment variable
    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      try {
        const parsed = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
        credential = cert(parsed);
        logger.info('[Firebase Admin] Initialized with FIREBASE_SERVICE_ACCOUNT_KEY JSON');
      } catch (parseErr) {
        logger.error('[Firebase Admin] Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:', parseErr.message);
      }
    }

    // 2. File path in GOOGLE_APPLICATION_CREDENTIALS
    if (!credential && process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
      if (fs.existsSync(credPath)) {
        try {
          const raw = fs.readFileSync(credPath, 'utf-8');
          const parsed = JSON.parse(raw);
          credential = cert(parsed);
          logger.info(`[Firebase Admin] Initialized with credentials from file: ${credPath}`);
        } catch (fileErr) {
          logger.error(`[Firebase Admin] Failed reading credentials file: ${fileErr.message}`);
        }
      } else {
        logger.warn(`[Firebase Admin] GOOGLE_APPLICATION_CREDENTIALS file not found: ${credPath}`);
      }
    }

    // 3. Individual environment variables
    if (!credential && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
      try {
        const privateKey = process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n');
        credential = cert({
          projectId: EXPECTED_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey,
        });
        logger.info('[Firebase Admin] Initialized with FIREBASE_CLIENT_EMAIL and FIREBASE_PRIVATE_KEY');
      } catch (keyErr) {
        logger.error('[Firebase Admin] Failed parsing individual credentials:', keyErr.message);
      }
    }

    // 4. Default initialization with Project ID (allows verifying ID tokens via Google's public x509 certificates)
    if (!credential) {
      logger.info(`[Firebase Admin] Initializing with project ID: ${EXPECTED_PROJECT_ID} (Public key verification mode)`);
      firebaseAdminApp = initializeApp({
        projectId: EXPECTED_PROJECT_ID,
      });
      return firebaseAdminApp;
    }

    firebaseAdminApp = initializeApp({
      credential,
      projectId: EXPECTED_PROJECT_ID,
    });

    return firebaseAdminApp;
  } catch (err) {
    logger.error('[Firebase Admin] Initialization error:', err.message);
    throw err;
  }
}

/**
 * Returns Firebase Auth instance for the configured Admin app
 */
export function getFirebaseAuth() {
  const app = getFirebaseAdmin();
  return getAuth(app);
}

/**
 * Verifies a Firebase ID token using the official Firebase Admin SDK.
 * Validates:
 * 1. Signature and expiration via verifyIdToken
 * 2. Audience / project ID matches EXPECTED_PROJECT_ID
 * 3. Verified email presence
 * 
 * @param {string} idToken - Raw Firebase ID token from frontend
 * @returns {Promise<{ uid: string, email: string, emailVerified: boolean, name: string, picture: string }>}
 */
export async function verifyFirebaseIdToken(idToken) {
  if (!idToken || typeof idToken !== 'string') {
    const error = new Error('Firebase ID token is required.');
    error.statusCode = 400;
    throw error;
  }

  const auth = getFirebaseAuth();

  try {
    const decoded = await auth.verifyIdToken(idToken.trim());

    // Strict validation of expected Project ID / Audience
    const tokenAudience = decoded.aud;
    if (tokenAudience !== EXPECTED_PROJECT_ID) {
      logger.warn(`[Firebase Admin] Project ID mismatch: expected ${EXPECTED_PROJECT_ID}, got ${tokenAudience}`);
      const err = new Error('Token does not match authorized project audience.');
      err.statusCode = 401;
      throw err;
    }

    // Confirm authenticated Firebase identity comes from expected Google provider
    const provider = decoded.firebase?.sign_in_provider;
    if (provider && provider !== 'google.com') {
      logger.warn(`[Firebase Admin] Provider mismatch: expected google.com, got ${provider}`);
      const err = new Error('Token was not issued by Google provider.');
      err.statusCode = 401;
      throw err;
    }

    if (!decoded.email) {
      const err = new Error('Google account must provide an email address.');
      err.statusCode = 400;
      throw err;
    }

    // Require verified email for Google Social Authentication
    if (decoded.email_verified !== true) {
      const err = new Error('Unverified email addresses cannot be used for authentication.');
      err.statusCode = 403;
      throw err;
    }

    return {
      uid: decoded.uid,
      email: String(decoded.email).toLowerCase().trim(),
      emailVerified: true,
      name: decoded.name || decoded.displayName || '',
      picture: decoded.picture || decoded.photoURL || null,
    };
  } catch (err) {
    if (err.statusCode) {
      throw err;
    }

    logger.warn(`[Firebase Admin] Token verification failed: ${err.code || err.message}`);

    // Return safe generic errors to client without leaking internal details or stack traces
    const safeError = new Error('Invalid, expired, or revoked authentication token.');
    safeError.statusCode = 401;
    throw safeError;
  }
}
