import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: Number(process.env.PORT) || 5001,
  nodeEnv: process.env.NODE_ENV || 'development',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5000',
  databaseUrl: process.env.DATABASE_URL || '',
  directUrl: process.env.DIRECT_URL || '',
  jwtSecret: process.env.JWT_SECRET || 'hisabflow-secure-jwt-secret-key-neon-db',
  adminInitialPassword: process.env.ADMIN_INITIAL_PASSWORD || 'Mahbub@12345',
  userInitialPassword: process.env.USER_INITIAL_PASSWORD || 'User@12345',
  firebaseProjectId: process.env.FIREBASE_PROJECT_ID || 'account-ladger01',
};
