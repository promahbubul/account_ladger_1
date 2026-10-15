import { Router } from 'express';
import { updateProfile } from '../controllers/user.controller.js';
import { authenticateToken } from '../middleware/auth.js';

export const userRouter = Router();

userRouter.put('/profile', authenticateToken, updateProfile);
