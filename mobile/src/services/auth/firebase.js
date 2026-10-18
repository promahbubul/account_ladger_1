import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  signInWithCredential,
  signOut,
} from 'firebase/auth';
import { Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';

WebBrowser.maybeCompleteAuthSession();

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || 'AIzaSyCcaQTcmWBNr7gFVHVOrWqZdvJJ61KzEqc',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || 'account-ladger01.firebaseapp.com',
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || 'account-ladger01',
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || 'account-ladger01.firebasestorage.app',
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '170169573200',
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || '1:170169573200:web:80be6390580613bf085655',
};

export const firebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(firebaseApp);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

/**
 * Checks if user just returned from a full-page redirect flow on Web.
 * Returns { idToken, user } if redirect was pending, or null otherwise.
 */
export async function checkRedirectAuthResult() {
  if (Platform.OS === 'web') {
    try {
      const result = await getRedirectResult(firebaseAuth);
      if (result && result.user) {
        const idToken = await result.user.getIdToken();
        return { idToken, user: result.user };
      }
    } catch (err) {
      if (err.code !== 'auth/no-redirect-credential') {
        console.warn('[Firebase Auth] Redirect auth result check:', err.message);
      }
    }
  }
  return null;
}

/**
 * Native Google Sign-In via Expo WebBrowser / AuthSession.
 * Opens system browser (Chrome Custom Tabs on Android / ASWebAuthenticationSession on iOS).
 * Never triggers popup blocked errors.
 */
async function signInWithGoogleNative() {
  const defaultWebClientId = '170169573200-81p7gq2ftufuoddisdjp26acet2ntk4i.apps.googleusercontent.com';
  const webClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID || defaultWebClientId;
  const androidClientId = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || webClientId;
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || webClientId;

  const clientId = Platform.select({
    android: androidClientId,
    ios: iosClientId,
    default: webClientId,
  }) || defaultWebClientId;

  if (!clientId) {
    throw new Error(
      'Google Client ID is not configured. Please set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID or EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID in mobile/.env'
    );
  }

  const redirectUri = AuthSession.makeRedirectUri({
    scheme: 'accountledger',
    preferLocalhost: false,
  });

  const queryParams = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'id_token token',
    scope: 'openid profile email',
    prompt: 'select_account',
    nonce: Math.random().toString(36).substring(2),
  });

  const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${queryParams.toString()}`;

  const authResult = await WebBrowser.openAuthSessionAsync(authUrl, redirectUri);

  if (authResult.type === 'cancel' || authResult.type === 'dismiss') {
    throw new Error('Sign-in cancelled: The Google sign-in window was closed.');
  }

  if (authResult.type !== 'success' || !authResult.url) {
    throw new Error('Google sign-in could not be completed.');
  }

  // Parse id_token from redirect URL hash or query string
  const urlParts = authResult.url.split('#');
  const fragment = urlParts.length > 1 ? urlParts[1] : authResult.url.split('?')[1] || '';
  const parsedParams = new URLSearchParams(fragment);
  const idToken = parsedParams.get('id_token');
  const accessToken = parsedParams.get('access_token');

  if (!idToken) {
    throw new Error('Did not receive an identity token from Google authentication.');
  }

  // Authenticate to Firebase using Google credential to get verified Firebase ID token
  const credential = GoogleAuthProvider.credential(idToken, accessToken || undefined);
  const userCredential = await signInWithCredential(firebaseAuth, credential);
  const firebaseIdToken = await userCredential.user.getIdToken();

  return {
    idToken: firebaseIdToken,
    user: userCredential.user,
  };
}

/**
 * Web Google Sign-In with automatic fallback from popup to full-page redirect.
 */
async function signInWithGoogleWeb() {
  try {
    const result = await signInWithPopup(firebaseAuth, googleProvider);
    const idToken = await result.user.getIdToken();
    return { idToken, user: result.user };
  } catch (error) {
    // If popup was blocked by browser or closed before interaction, seamlessly use redirect
    if (error.code === 'auth/popup-blocked' || error.code === 'auth/cancelled-popup-request') {
      await signInWithRedirect(firebaseAuth, googleProvider);
      return { redirecting: true };
    }
    if (error.code === 'auth/popup-closed-by-user') {
      throw new Error('Sign-in cancelled: The Google sign-in window was closed.');
    }
    if (error.code === 'auth/network-request-failed') {
      throw new Error('Network connection error during Google authentication. Please check your internet connection.');
    }
    throw new Error(error.message || 'Google authentication failed.');
  }
}

/**
 * Unified cross-platform Google Sign-In for AccountLedger mobile app.
 */
export async function signInWithGoogleFirebase() {
  if (Platform.OS === 'web') {
    return await signInWithGoogleWeb();
  }
  return await signInWithGoogleNative();
}

/**
 * Signs out of the Firebase Auth session.
 */
export async function signOutFirebase() {
  try {
    await signOut(firebaseAuth);
  } catch (error) {
    console.warn('[Firebase Auth] signOut error:', error.message);
  }
}
