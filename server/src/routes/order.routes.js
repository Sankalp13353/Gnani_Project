/**
 * Order Routes
 */

import { Router } from 'express';
import { parseOrder } from '../controllers/order.controller.js';

const router = Router();

// POST /api/orders/parse - Order understanding and draft order generation
router.post('/orders/parse', parseOrder);

export default router;

