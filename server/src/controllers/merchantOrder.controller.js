/**
 * Merchant Order Controller
 * Exposes authenticated endpoints for store owner order review, status transitions,
 * in-store payment recording, and packing slips.
 */

import {
  listMerchantOrders,
  getMerchantOrderSummary,
  getMerchantOrderById,
  acceptOrder,
  rejectOrder,
  startOrderPreparation,
  markOrderReadyForPickup,
  recordOrderPayment,
  completeOrder,
  getPackingSlipData,
} from '../services/merchantOrder.service.js';

/**
 * GET /api/merchant/orders
 * List orders belonging to the authenticated store.
 */
export const listOrders = async (req, res, next) => {
  try {
    const { status, search, page, limit } = req.query;
    const storeId = req.storeId;

    const result = await listMerchantOrders({
      storeId,
      status,
      search,
      page,
      limit,
    });

    return res.status(200).json({
      success: true,
      data: result.orders,
      pagination: result.pagination,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/merchant/orders/summary
 * Returns order count breakdown by status.
 */
export const getSummary = async (req, res, next) => {
  try {
    const storeId = req.storeId;
    const summary = await getMerchantOrderSummary({ storeId });

    return res.status(200).json({
      success: true,
      data: summary,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/merchant/orders/:orderId
 * Retrieve full order details including customer phone and line items.
 */
export const getOrder = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const storeId = req.storeId;

    const order = await getMerchantOrderById({ storeId, orderId });

    return res.status(200).json({
      success: true,
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/merchant/orders/:orderId/accept
 * Store owner accepts a pending order.
 */
export const accept = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const storeId = req.storeId;

    const order = await acceptOrder({ storeId, orderId });

    return res.status(200).json({
      success: true,
      data: order,
      message: 'Order accepted successfully. You can now start preparation or print the packing slip.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/merchant/orders/:orderId/reject
 * Store owner rejects a pending order with a reason.
 */
export const reject = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { rejectionReason } = req.body;
    const storeId = req.storeId;

    const order = await rejectOrder({ storeId, orderId, rejectionReason });

    return res.status(200).json({
      success: true,
      data: order,
      message: 'Order rejected.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/merchant/orders/:orderId/prepare
 * Store owner marks an accepted order as preparing.
 */
export const prepare = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const storeId = req.storeId;

    const order = await startOrderPreparation({ storeId, orderId });

    return res.status(200).json({
      success: true,
      data: order,
      message: 'Order preparation started.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/merchant/orders/:orderId/ready
 * Store owner marks an order as packed and ready for pickup.
 */
export const markReady = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const storeId = req.storeId;

    const order = await markOrderReadyForPickup({ storeId, orderId });

    return res.status(200).json({
      success: true,
      data: order,
      message: 'Order is ready for customer pickup.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/merchant/orders/:orderId/payment
 * Record in-store payment (CASH_ON_PICKUP or UPI_AT_STORE).
 */
export const recordPayment = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { paymentMethod } = req.body;
    const storeId = req.storeId;

    const order = await recordOrderPayment({ storeId, orderId, paymentMethod });

    return res.status(200).json({
      success: true,
      data: order,
      message: 'Payment recorded successfully.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PATCH /api/merchant/orders/:orderId/complete
 * Complete order after physical pickup and confirmed payment.
 */
export const complete = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const { paymentMethod } = req.body;
    const storeId = req.storeId;

    const order = await completeOrder({ storeId, orderId, paymentMethod });

    return res.status(200).json({
      success: true,
      data: order,
      message: 'Order marked as completed.',
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/merchant/orders/:orderId/packing-slip
 * Retrieve packing slip details for accepted/preparing/ready orders.
 */
export const getPackingSlip = async (req, res, next) => {
  try {
    const { orderId } = req.params;
    const storeId = req.storeId;

    const packingSlip = await getPackingSlipData({ storeId, orderId });

    return res.status(200).json({
      success: true,
      data: packingSlip,
    });
  } catch (error) {
    next(error);
  }
};

export default {
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
};

