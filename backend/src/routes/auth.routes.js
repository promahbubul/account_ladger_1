import { Router } from 'express';
import { login, register, googleLogin, getMe } from '../controllers/auth.controller.js';
import { authenticateToken } from '../middleware/auth.js';

export const authRouter = Router();

authRouter.post('/login', login);
authRouter.post('/register', register);
authRouter.post('/google', googleLogin);
authRouter.get('/me', authenticateToken, getMe);
