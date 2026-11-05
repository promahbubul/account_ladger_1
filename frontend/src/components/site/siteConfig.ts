// Always the newest release; see .github/workflows/publish-apk.yml.
export const APK_URL = 'https://github.com/promahbubul/account_ladger_1/releases/latest/download/AccountLedger-release.apk';

// The Contact page and its links appear once this is set.
export const CONTACT_EMAIL = '';

export const PUBLIC_PATHS = ['/', '/features', '/download', '/contact', '/privacy', '/terms', '/landing'];

export const isPublicPath = (path: string) => PUBLIC_PATHS.includes(path.replace(/\/+$/, '') || '/');
