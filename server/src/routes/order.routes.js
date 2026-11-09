/**
 * Order Routes
 * Endpoints for customer order parsing, cart calculation, order submission, and order retrieval.
 */

import { Router } from 'express';
import {
  parseOrder,
  calculatePricing,
  submitOrder,
  getOrder,
} from '../controllers/order.controller.js';

const router = Router();

// POST /api/orders/parse - Store-scoped order understanding and draft generation
router.post('/orders/parse', parseOrder);

// POST /api/orders/calculate - Cart line item verification and trusted pricing calculation
router.post('/orders/calculate', calculatePricing);

// POST /api/orders - Customer order creation (atomic transaction & idempotency)
router.post('/orders', submitOrder);

// GET /api/orders/:id - Customer order confirmation details
router.get('/orders/:id', getOrder);

export default router;
