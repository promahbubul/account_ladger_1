import { StyleSheet } from 'react-native';

const PALETTES = {
  dark: {
  // Foundations: Dark, modern, neutral fintech palette
  background: '#090A0E',
  surface: '#12141A',
  surfaceElevated: '#171A22',
  surfaceSelected: '#1F2430',
  surfaceGhost: 'rgba(255, 255, 255, 0.03)',

  // Borders & Dividers: Minimal, whisper-quiet lines
  border: '#1E222B',
  borderLight: '#262C38',
  borderSubtle: 'rgba(255, 255, 255, 0.06)',
  borderHairline: 'rgba(255, 255, 255, 0.04)',

  // Accents: Refined & restrained
  primary: '#3B82F6',
  primaryDark: '#2563EB',
  primaryLight: 'rgba(59, 130, 246, 0.12)',

  // Financial Semantics: Mint emerald for inflows, soft coral for outflows
  success: '#10B981',
  successLight: 'rgba(16, 185, 129, 0.12)',
  danger: '#F43F5E',
  dangerLight: 'rgba(244, 63, 94, 0.12)',
  warning: '#F59E0B',
  warningLight: 'rgba(245, 158, 11, 0.12)',
  purple: '#8B5CF6',
  purpleLight: 'rgba(139, 92, 246, 0.12)',

  // Typography Contrast
  text: '#F8FAFC',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  textInverse: '#090A0E',

  // Chart series, validated for this dark surface. Separate from the status colors above.
  chartPrimary: '#3987E5',
  chartSecondary: '#D95926',

  card: '#12141A',
  cardHover: '#181B24',
},
  light: {
  // Foundations
  background: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceElevated: '#F1F5F9',
  surfaceSelected: '#E2E8F0',
  surfaceGhost: 'rgba(15, 23, 42, 0.03)',

  // Borders & Dividers
  border: '#E2E8F0',
  borderLight: '#CBD5E1',
  borderSubtle: 'rgba(15, 23, 42, 0.08)',
  borderHairline: 'rgba(15, 23, 42, 0.06)',

  // Accents
  primary: '#2563EB',
  primaryDark: '#1D4ED8',
  primaryLight: 'rgba(37, 99, 235, 0.10)',

  // Financial Semantics, darker so they stay readable on white
  success: '#047857',
  successLight: 'rgba(4, 120, 87, 0.10)',
  danger: '#BE123C',
  dangerLight: 'rgba(190, 18, 60, 0.10)',
  warning: '#B45309',
  warningLight: 'rgba(180, 83, 9, 0.10)',
  purple: '#6D28D9',
  purpleLight: 'rgba(109, 40, 217, 0.10)',

  // Typography Contrast
  text: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#64748B',
  textInverse: '#FFFFFF',

  // The same series colours in both themes, so a series keeps its identity.
  chartPrimary: '#3987E5',
  chartSecondary: '#D95926',

  card: '#FFFFFF',
  cardHover: '#F1F5F9',
},
};

let activeTheme = 'dark';

export const setActiveTheme = (theme) => {
  activeTheme = theme;
};

// Reads from whichever theme is active at the moment it is used.
export const COLORS = new Proxy({}, {
  get: (_, key) => PALETTES[activeTheme][key],
});

// StyleSheet.create for styles that use COLORS: builds one sheet per theme, the first time each is needed.
export const themedStyles = (build) => {
  const sheets = {};
  return new Proxy({}, {
    get: (_, key) => {
      if (!sheets[activeTheme]) sheets[activeTheme] = StyleSheet.create(build());
      return sheets[activeTheme][key];
    },
  });
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
};

export const FONT_SIZE = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  xxl: 24,
  title: 28,
  hero: 34,
};

export const RADIUS = {
  xs: 4,
  sm: 6,
  md: 8,
  lg: 14,
  xl: 18,
  full: 9999,
};
