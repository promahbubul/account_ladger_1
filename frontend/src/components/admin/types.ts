export interface ManagedUser {
  id: string;
  username: string;
  email: string;
  fullName: string;
  role: 'ADMIN' | 'USER';
  isActive: boolean;
  currency: string;
  createdAt: string;
}

export interface AdminStats {
  status: {
    connectedToNeon: boolean;
    mode: string;
    storageFile: string;
    userCount: number;
    accountCount: number;
    transactionCount: number;
  };
  totalUsers: number;
  activeUsers: number;
  adminCount: number;
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
  appName: string;
  maintenanceMode: boolean;
  allowUserRegistration: boolean;
  defaultCurrency: string;
  sessionTimeoutHours: number;
  auditLoggingEnabled: boolean;
  updatedAt: string;
}
