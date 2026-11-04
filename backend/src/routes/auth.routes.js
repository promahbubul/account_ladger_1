import { Router } from 'express';
import {
  login,
  register,
  googleLogin,
  getMe,
  forgotPassword,
  verifyResetToken,
  resetPassword,
  verifyEmail,
  resendVerification,
} from '../controllers/auth.controller.js';
import { authenticateToken } from '../middleware/auth.js';
import {
  googleAuthRateLimiter,
  loginAccountRateLimiter,
  loginIpRateLimiter,
  registerRateLimiter,
  forgotPasswordRateLimiter,
  resetPasswordRateLimiter,
  verifyEmailRateLimiter,
  resendVerificationRateLimiter,
} from '../middleware/rate-limiter.js';

export const authRouter = Router();

authRouter.post('/login', loginIpRateLimiter, loginAccountRateLimiter, login);
authRouter.post('/register', registerRateLimiter, register);
authRouter.post('/verify-email', verifyEmailRateLimiter, verifyEmail);
authRouter.post('/resend-verification', resendVerificationRateLimiter, resendVerification);
authRouter.post('/google', googleAuthRateLimiter, googleLogin);
authRouter.post('/google/link', googleAuthRateLimiter, googleLogin);
authRouter.get('/me', authenticateToken, getMe);

// Forgot Password & Reset Password Endpoints
authRouter.post('/forgot-password', forgotPasswordRateLimiter, forgotPassword);
authRouter.get('/verify-reset-token', verifyResetToken);
authRouter.post('/reset-password', resetPasswordRateLimiter, resetPassword);

