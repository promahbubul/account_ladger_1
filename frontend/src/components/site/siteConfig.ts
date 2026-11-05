// Always the newest release; see .github/workflows/publish-apk.yml.
export const APK_URL = 'https://github.com/promahbubul/account_ladger_1/releases/latest/download/AccountLedger-release.apk';

// Website pictures: the widths on disk, the full picture's shape, and how wide each is shown.
export const SCREENS: Record<string, { widths: number[]; width: number; height: number; sizes: string }> = {
  dashboard: { widths: [800, 1600], width: 2560, height: 1520, sizes: '(min-width: 1152px) 1008px, 90vw' },
  reports: { widths: [800, 1600], width: 2560, height: 1520, sizes: '(min-width: 1152px) 1104px, 94vw' },
  project: { widths: [700, 1400], width: 2048, height: 1166, sizes: '(min-width: 1024px) 640px, 92vw' },
  mobile: { widths: [300, 600], width: 780, height: 1560, sizes: '(min-width: 1024px) 208px, 272px' },
};

export const screenSrcSet = (name: string, theme: string) =>
  SCREENS[name].widths.map((w) => `/screens/${name}-${theme}-${w}.webp ${w}w`).join(', ');

// The Contact page and its links appear once this is set.
export const CONTACT_EMAIL = 'mahbublalam500@gmail.com';

export const PUBLIC_PATHS = ['/', '/features', '/download', '/contact', '/privacy', '/terms', '/landing'];

export const isPublicPath = (path: string) => PUBLIC_PATHS.includes(path.replace(/\/+$/, '') || '/');

export const AUTH_PATHS = ['/login', '/register', '/forgot-password', '/reset-password', '/verify-email'];
