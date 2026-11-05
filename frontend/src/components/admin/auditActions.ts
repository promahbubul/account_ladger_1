// Plain words for the codes stored in the audit log.
export const AUDIT_ACTIONS: Record<string, string> = {
  LOGIN: 'Signed in',
  LOGIN_FAILED: 'Wrong password',
  LOGIN_GOOGLE: 'Signed in with Google',
  REGISTER_UNVERIFIED: 'Registered',
  REGISTER_GOOGLE: 'Registered with Google',
  ACCOUNT_AUTO_LINKED_GOOGLE: 'Google linked',
  PASSWORD_RESET: 'Password changed',
  PASSWORD_RESET_REQUESTED: 'Password reset requested',
  CREATE_USER: 'User created',
  UPDATE_USER: 'User edited',
  ACTIVATE_USER: 'User activated',
  DEACTIVATE_USER: 'User deactivated',
  RESET_PASSWORD: 'Admin reset password',
  DELETE_USER: 'User deleted',
  UPDATE_SETTINGS: 'Settings changed',
};

export const actionLabel = (action: string) => {
  if (AUDIT_ACTIONS[action]) return AUDIT_ACTIONS[action];
  const words = action.toLowerCase().replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
};

const BADGE_STYLES = {
  danger: 'bg-red-950/70 text-red-300 border border-red-800/60',
  login: 'bg-blue-950/70 text-blue-300 border border-blue-800/60',
  admin: 'bg-purple-950/70 text-purple-300 border border-purple-800/60',
  other: 'bg-gray-800 text-gray-300 border border-gray-700',
};

export const actionBadgeStyle = (action: string) => {
  if (action === 'LOGIN_FAILED' || action === 'DELETE_USER' || action === 'DEACTIVATE_USER') return BADGE_STYLES.danger;
  if (action.startsWith('LOGIN')) return BADGE_STYLES.login;
  if (action.includes('USER') || action === 'RESET_PASSWORD' || action === 'UPDATE_SETTINGS') return BADGE_STYLES.admin;
  return BADGE_STYLES.other;
};
