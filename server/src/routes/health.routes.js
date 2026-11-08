import { Router } from 'express';
import { checkHealth, checkDbHealth } from '../controllers/health.controller.js';

const router = Router();

// GET /api/health - Application health status
router.get('/health', checkHealth);

// GET /api/health/db - Database connectivity status
router.get('/health/db', checkDbHealth);

export default router;
