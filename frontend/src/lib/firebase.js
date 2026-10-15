import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signOut,
} from 'firebase/auth';

/**
 * Firebase Web App Configuration
 * Reads from NEXT_PUBLIC_ / VITE_ environment variables with fallback to project config.
 */
const firebaseConfig = {
  apiKey:
    (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_FIREBASE_API_KEY) ||
    (typeof import.meta !== 'undefined' &&
      import.meta.env &&
      (import.meta.env.NEXT_PUBLIC_FIREBASE_API_KEY || import.meta.env.VITE_FIREBASE_API_KEY)) ||
    'AIzaSyCcaQTcmWBNr7gFVHVOrWqZdvJJ61KzEqc',
  authDomain:
    (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN) ||
    (typeof import.meta !== 'undefined' &&
      import.meta.env &&
      (import.meta.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || import.meta.env.VITE_FIREBASE_AUTH_DOMAIN)) ||
    'account-ladger01.firebaseapp.com',
  projectId:
    (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_FIREBASE_PROJECT_ID) ||
    (typeof import.meta !== 'undefined' &&
      import.meta.env &&
      (import.meta.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || import.meta.env.VITE_FIREBASE_PROJECT_ID)) ||
    'account-ladger01',
  storageBucket:
    (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET) ||
    (typeof import.meta !== 'undefined' &&
      import.meta.env &&
      (import.meta.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || import.meta.env.VITE_FIREBASE_STORAGE_BUCKET)) ||
    'account-ladger01.firebasestorage.app',
  messagingSenderId:
    (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID) ||
    (typeof import.meta !== 'undefined' &&
      import.meta.env &&
      (import.meta.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID)) ||
    '170169573200',
  appId:
    (typeof process !== 'undefined' && process.env?.NEXT_PUBLIC_FIREBASE_APP_ID) ||
    (typeof import.meta !== 'undefined' &&
      import.meta.env &&
      (import.meta.env.NEXT_PUBLIC_FIREBASE_APP_ID || import.meta.env.VITE_FIREBASE_APP_ID)) ||
    '1:170169573200:web:80be6390580613bf085655',
};

// Initialize Firebase singleton
export const firebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firebase Auth
export const auth = getAuth(firebaseApp);

// Configure Google Provider
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: 'select_account',
});

/**
 * Initiates Google sign-in popup using official Firebase Authentication SDK.
 * Retrieves verified Firebase ID token for transmission to the backend.
 * 
 * @returns {Promise<{ idToken: string, user: import('firebase/auth').User }>}
 */
export async function signInWithGoogle() {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    const idToken = await result.user.getIdToken();
    return {
      idToken,
      user: result.user,
    };
  } catch (error) {
    // Map Firebase auth error codes to clear, actionable user messages
    let friendlyMessage = 'Google authentication was cancelled or could not be completed.';
    if (error.code === 'auth/popup-closed-by-user') {
      friendlyMessage = 'Sign-in cancelled: The Google sign-in window was closed.';
    } else if (error.code === 'auth/popup-blocked') {
      friendlyMessage = 'The Google sign-in popup was blocked by your browser. Please allow popups for this site and try again.';
    } else if (error.code === 'auth/unauthorized-domain') {
      friendlyMessage = 'This domain is not authorized in Firebase Console (Authentication > Settings > Authorized domains).';
    } else if (error.code === 'auth/network-request-failed') {
      friendlyMessage = 'Network connection error during Google authentication. Please check your internet connection.';
    } else if (error.message) {
      friendlyMessage = error.message;
    }

    const customErr = new Error(friendlyMessage);
    customErr.code = error.code;
    throw customErr;
  }
}

/**
 * Signs out of the Firebase Auth session.
 */
export async function signOutFirebase() {
  try {
    await signOut(auth);
  } catch (error) {
    console.warn('Firebase signOut error:', error);
  }
}
