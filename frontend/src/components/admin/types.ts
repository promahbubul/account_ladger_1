export interface ManagedUser {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: 'ADMIN' | 'USER';
  isActive: boolean;
  emailVerified?: boolean;
  currency: string;
  createdAt: string;
}

export interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  adminCount: number;
  unverifiedUsers: number;
  newUsersThisWeek: number;
  totalTransactions: number;
  totalAccounts: number;
  databaseConnected: boolean;
}

export interface AuditLog {
  id: string;
  userId: string;
  userEmail?: string;
  action: string;
  entityType: string;
  entityId: string;
  details?: string;
  ipAddress?: string;
  createdAt: string;
}

export interface SystemSettings {
  allowUserRegistration: boolean;
  defaultCurrency: string;
  updatedAt?: string;
}
