/**
 * Merchant Order Routes
 * Endpoints for store owner order dashboard, status transitions, in-store payment, and packing slips.
 * All routes require valid merchant authentication.
 */

import { Router } from 'express';
import { authenticateMerchant } from '../middleware/auth.middleware.js';
import {
  listOrders,
  getSummary,
  getOrder,
  accept,
  reject,
  prepare,
  markReady,
  recordPayment,
  complete,
  getPackingSlip,
} from '../controllers/merchantOrder.controller.js';

const router = Router();

// Protect all merchant order endpoints with merchant authentication
router.use(authenticateMerchant);

// GET /api/merchant/orders - List store orders with filtering and pagination
router.get('/', listOrders);

// GET /api/merchant/orders/summary - Order status counts
router.get('/summary', getSummary);

// GET /api/merchant/orders/:orderId - Order details (including customer phone)
router.get('/:orderId', getOrder);

// GET /api/merchant/orders/:orderId/packing-slip - Printable packing slip
router.get('/:orderId/packing-slip', getPackingSlip);

// PATCH /api/merchant/orders/:orderId/accept - Accept pending order
router.patch('/:orderId/accept', accept);

// PATCH /api/merchant/orders/:orderId/reject - Reject pending order with reason
router.patch('/:orderId/reject', reject);

// PATCH /api/merchant/orders/:orderId/prepare - Start preparation
router.patch('/:orderId/prepare', prepare);

// PATCH /api/merchant/orders/:orderId/ready - Mark packed and ready for pickup
router.patch('/:orderId/ready', markReady);

// PATCH /api/merchant/orders/:orderId/payment - Record in-store payment
router.patch('/:orderId/payment', recordPayment);

// PATCH /api/merchant/orders/:orderId/complete - Mark completed after collection & payment
router.patch('/:orderId/complete', complete);

export default router;

