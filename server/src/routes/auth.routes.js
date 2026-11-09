/**
 * Authentication Routes
 * Exposes endpoints for merchant registration, login, logout, and authenticated profile retrieval.
 */

import { Router } from 'express';
import { register, login, logout, getMe } from '../controllers/auth.controller.js';
import { authenticateMerchant } from '../middleware/auth.middleware.js';

const router = Router();

// POST /api/auth/register - Register a new Kirana store
router.post('/register', register);

// POST /api/auth/login - Authenticate merchant
router.post('/login', login);

// POST /api/auth/logout - Terminate merchant session
router.post('/logout', logout);

// GET /api/auth/me - Retrieve authenticated merchant store profile
router.get('/me', authenticateMerchant, getMe);

export default router;

