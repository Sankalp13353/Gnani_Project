/**
 * Order Controller
 * Handles HTTP requests for order understanding, pricing calculation, order creation, and order retrieval.
 */

import { parseOrderTranscript } from '../services/orderUnderstanding.service.js';
import {
  calculateOrderPricing,
  createCustomerOrder,
  getCustomerOrderById,
} from '../services/order.service.js';

/**
 * Controller to handle POST /api/orders/parse
 * Scoped strictly to the specified store with active/available items.
 */
export const parseOrder = async (req, res, next) => {
  try {
    const { transcript, store_id, storeId } = req.body;

    if (!transcript || typeof transcript !== 'string' || transcript.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Transcript is required and must be a non-empty string',
      });
    }

    const targetStoreId = store_id || storeId;
    if (!targetStoreId) {
      return res.status(400).json({
        success: false,
        message: 'Store ID is required',
      });
    }

    const draftOrder = await parseOrderTranscript(transcript, {
      storeId: targetStoreId,
      allowLegacyFallback: false,
    });

    return res.status(200).json({
      success: true,
      data: draftOrder,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller to handle POST /api/orders/calculate
 * Verifies catalogue items against store and recalculates line totals and subtotal.
 */
export const calculatePricing = async (req, res, next) => {
  try {
    const { store_id, storeId, items } = req.body;
    const targetStoreId = store_id || storeId;

    if (!targetStoreId) {
      return res.status(400).json({
        success: false,
        message: 'Store ID is required',
      });
    }

    const result = await calculateOrderPricing({
      storeId: targetStoreId,
      items,
    });

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller to handle POST /api/orders
 * Atomically creates customer order with initial status PENDING_APPROVAL and paymentStatus UNPAID.
 */
export const submitOrder = async (req, res, next) => {
  try {
    const { store_id, storeId, items, customerName, customerPhone, notes, source, confirmationToken: bodyToken } = req.body;
    const targetStoreId = store_id || storeId;

    if (!targetStoreId) {
      return res.status(400).json({
        success: false,
        message: 'Store ID is required',
      });
    }

    const idempotencyKey =
      req.headers['idempotency-key'] ||
      req.headers['x-idempotency-key'] ||
      req.body.idempotencyKey ||
      null;

    const confirmationToken =
      req.headers['x-confirmation-token'] ||
      bodyToken ||
      null;

    const { order, isDuplicate } = await createCustomerOrder({
      storeId: targetStoreId,
      customerName,
      customerPhone,
      notes,
      items,
      idempotencyKey,
      confirmationToken,
      source,
    });

    return res.status(isDuplicate ? 200 : 201).json({
      success: true,
      data: order,
      message: isDuplicate ? 'Existing order returned (duplicate prevented)' : 'Order created successfully',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Controller to handle GET /api/orders/:id
 * Retrieves order details for customer confirmation page.
 * Safely accepts optional customer confirmation token for authorized verification.
 */
export const getOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const token =
      (req.query && req.query.token) ||
      req.headers['x-confirmation-token'] ||
      null;

    const order = await getCustomerOrderById(id, token);

    return res.status(200).json({
      success: true,
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

export default {
  parseOrder,
  calculatePricing,
  submitOrder,
  getOrder,
};
