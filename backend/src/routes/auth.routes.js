import { Router } from 'express';
import {
  login,
  register,
  googleLogin,
  getMe,
  forgotPassword,
  verifyResetToken,
  resetPassword,
} from '../controllers/auth.controller.js';
import { authenticateToken } from '../middleware/auth.js';
import { forgotPasswordRateLimiter, resetPasswordRateLimiter } from '../middleware/rate-limiter.js';

export const authRouter = Router();

authRouter.post('/login', login);
authRouter.post('/register', register);
authRouter.post('/google', googleLogin);
authRouter.post('/google/link', googleLogin);
authRouter.get('/me', authenticateToken, getMe);

// Forgot Password & Reset Password Endpoints
authRouter.post('/forgot-password', forgotPasswordRateLimiter, forgotPassword);
authRouter.get('/verify-reset-token', verifyResetToken);
authRouter.post('/reset-password', resetPasswordRateLimiter, resetPassword);
