/**
 * Merchant Order Service
 * Handles store-scoped order lifecycle transitions, payment recording, and packing slip generation.
 * All operations are strictly tenant-isolated to the authenticated store.
 */

import prisma from '../config/prisma.js';
import { logger } from '../utils/logger.js';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isValidUuid = (id) => typeof id === 'string' && UUID_REGEX.test(id.trim());

const VALID_STATUSES = [
  'PENDING_APPROVAL',
  'ACCEPTED',
  'PREPARING',
  'READY_FOR_PICKUP',
  'COMPLETED',
  'REJECTED',
  'CANCELLED',
];

const VALID_PAYMENT_METHODS = ['CASH_ON_PICKUP', 'UPI_AT_STORE'];

/**
 * Formats order record for merchant dashboard.
 * Customer name & phone are included (permitted in authenticated merchant view).
 * Internal token hashes and password hashes are strictly omitted.
 */
export const formatMerchantOrder = (order) => ({
  id: order.id,
  orderNumber: order.orderNumber,
  storeId: order.storeId,
  status: order.status,
  paymentStatus: order.paymentStatus,
  paymentMethod: order.paymentMethod,
  source: order.source,
  subtotal: Number(order.subtotal).toFixed(2),
  notes: order.notes || null,
  rejectionReason: order.rejectionReason || null,
  createdAt: order.createdAt,
  updatedAt: order.updatedAt,
  acceptedAt: order.acceptedAt || null,
  readyAt: order.readyAt || null,
  completedAt: order.completedAt || null,
  customer: {
    id: order.customer?.id,
    name: order.customer?.name || 'Customer',
    phone: order.customer?.phone || null,
  },
  store: order.store
    ? {
        id: order.store.id,
        name: order.store.name,
        address: order.store.address,
        city: order.store.city,
        pincode: order.store.pincode,
        phone: order.store.phone,
        upiId: order.store.upiId || null,
      }
    : undefined,
  items: (order.items || []).map((item) => ({
    id: item.id,
    productId: item.productId,
    productName: item.productName,
    quantity: Number(item.quantity).toString(),
    unit: item.unit,
    unitPrice: Number(item.unitPrice).toFixed(2),
    lineTotal: Number(item.lineTotal).toFixed(2),
  })),
  itemsCount: order.items?.length ?? order._count?.items ?? 0,
});

/**
 * Lists orders belonging to the authenticated store with filtering and pagination.
 */
export const listMerchantOrders = async ({
  storeId,
  status,
  search,
  page = 1,
  limit = 20,
}) => {
  if (!storeId || !isValidUuid(storeId)) {
    const error = new Error('A valid store ID is required');
    error.status = 400;
    throw error;
  }

  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safeLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
  const skip = (safePage - 1) * safeLimit;

  const where = { storeId };

  if (status && typeof status === 'string') {
    const upperStatus = status.trim().toUpperCase();
    if (VALID_STATUSES.includes(upperStatus)) {
      where.status = upperStatus;
    }
  }

  if (search && typeof search === 'string' && search.trim().length > 0) {
    where.orderNumber = {
      contains: search.trim(),
      mode: 'insensitive',
    };
  }

  const [orders, totalOrders] = await Promise.all([
    prisma.order.findMany({
      where,
      skip,
      take: safeLimit,
      orderBy: { createdAt: 'desc' },
      include: {
        customer: {
          select: { id: true, name: true, phone: true },
        },
        items: true,
      },
    }),
    prisma.order.count({ where }),
  ]);

  const totalPages = Math.ceil(totalOrders / safeLimit) || 1;

  return {
    orders: orders.map(formatMerchantOrder),
    pagination: {
      page: safePage,
      limit: safeLimit,
      totalOrders,
      totalPages,
    },
  };
};

/**
 * Returns summary count of orders by status for the merchant dashboard overview.
 */
export const getMerchantOrderSummary = async ({ storeId }) => {
  if (!storeId || !isValidUuid(storeId)) {
    const error = new Error('A valid store ID is required');
    error.status = 400;
    throw error;
  }

  const [total, grouped] = await Promise.all([
    prisma.order.count({ where: { storeId } }),
    prisma.order.groupBy({
      by: ['status'],
      where: { storeId },
      _count: { id: true },
    }),
  ]);

  const summary = {
    all: total,
    PENDING_APPROVAL: 0,
    ACCEPTED: 0,
    PREPARING: 0,
    READY_FOR_PICKUP: 0,
    COMPLETED: 0,
    REJECTED: 0,
    CANCELLED: 0,
  };

  grouped.forEach((g) => {
    if (summary[g.status] !== undefined) {
      summary[g.status] = g._count.id;
    }
  });

  return summary;
};

/**
 * Retrieves full order details for the authenticated merchant.
 */
export const getMerchantOrderById = async ({ storeId, orderId }) => {
  if (!storeId || !isValidUuid(storeId)) {
    const error = new Error('A valid store ID is required');
    error.status = 400;
    throw error;
  }

  if (!orderId || !isValidUuid(orderId)) {
    const error = new Error('Invalid order ID format');
    error.status = 400;
    throw error;
  }

  const order = await prisma.order.findFirst({
    where: { id: orderId, storeId },
    include: {
      customer: {
        select: { id: true, name: true, phone: true },
      },
      store: {
        select: {
          id: true,
          name: true,
          address: true,
          city: true,
          pincode: true,
          phone: true,
          upiId: true,
        },
      },
      items: true,
    },
  });

  if (!order) {
    const error = new Error('Order not found or does not belong to your store');
    error.status = 404;
    throw error;
  }

  return formatMerchantOrder(order);
};

/**
 * Shopkeeper accepts a pending order.
 * Transition: PENDING_APPROVAL -> ACCEPTED.
 */
export const acceptOrder = async ({ storeId, orderId }) => {
  if (!storeId || !isValidUuid(storeId) || !orderId || !isValidUuid(orderId)) {
    const error = new Error('Valid store ID and order ID are required');
    error.status = 400;
    throw error;
  }

  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findFirst({
      where: { id: orderId, storeId },
    });

    if (!order) {
      const error = new Error('Order not found or does not belong to your store');
      error.status = 404;
      throw error;
    }

    if (order.status !== 'PENDING_APPROVAL') {
      const error = new Error(
        `Cannot accept order: only orders with status PENDING_APPROVAL can be accepted (current status: ${order.status})`
      );
      error.status = 400;
      throw error;
    }

    const updatedOrder = await tx.order.update({
      where: { id: order.id },
      data: {
        status: 'ACCEPTED',
        acceptedAt: new Date(),
      },
      include: {
        customer: {
          select: { id: true, name: true, phone: true },
        },
        store: {
          select: { id: true, name: true, address: true, city: true, pincode: true, phone: true, upiId: true },
        },
        items: true,
      },
    });

    logger.info(`Merchant accepted order: ${updatedOrder.orderNumber} for store: ${storeId}`);
    return formatMerchantOrder(updatedOrder);
  });
};

/**
 * Shopkeeper rejects a pending order with a required reason.
 * Transition: PENDING_APPROVAL -> REJECTED.
 */
export const rejectOrder = async ({ storeId, orderId, rejectionReason }) => {
  if (!storeId || !isValidUuid(storeId) || !orderId || !isValidUuid(orderId)) {
    const error = new Error('Valid store ID and order ID are required');
    error.status = 400;
    throw error;
  }

  if (
    !rejectionReason ||
    typeof rejectionReason !== 'string' ||
    rejectionReason.trim().length < 2
  ) {
    const error = new Error('A rejection reason is required (minimum 2 characters)');
    error.status = 400;
    throw error;
  }

  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findFirst({
      where: { id: orderId, storeId },
    });

    if (!order) {
      const error = new Error('Order not found or does not belong to your store');
      error.status = 404;
      throw error;
    }

    if (order.status !== 'PENDING_APPROVAL') {
      const error = new Error(
        `Cannot reject order: only orders with status PENDING_APPROVAL can be rejected (current status: ${order.status})`
      );
      error.status = 400;
      throw error;
    }

    const updatedOrder = await tx.order.update({
      where: { id: order.id },
      data: {
        status: 'REJECTED',
        rejectionReason: rejectionReason.trim(),
      },
      include: {
        customer: {
          select: { id: true, name: true, phone: true },
        },
        store: {
          select: { id: true, name: true, address: true, city: true, pincode: true, phone: true, upiId: true },
        },
        items: true,
      },
    });

    logger.info(`Merchant rejected order: ${updatedOrder.orderNumber} for store: ${storeId} (Reason: ${rejectionReason.trim()})`);
    return formatMerchantOrder(updatedOrder);
  });
};

/**
 * Shopkeeper starts preparing an accepted order.
 * Transition: ACCEPTED -> PREPARING.
 */
export const startOrderPreparation = async ({ storeId, orderId }) => {
  if (!storeId || !isValidUuid(storeId) || !orderId || !isValidUuid(orderId)) {
    const error = new Error('Valid store ID and order ID are required');
    error.status = 400;
    throw error;
  }

  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findFirst({
      where: { id: orderId, storeId },
    });

    if (!order) {
      const error = new Error('Order not found or does not belong to your store');
      error.status = 404;
      throw error;
    }

    if (order.status !== 'ACCEPTED') {
      const error = new Error(
        `Cannot start preparation: order must be in ACCEPTED status (current status: ${order.status})`
      );
      error.status = 400;
      throw error;
    }

    const updatedOrder = await tx.order.update({
      where: { id: order.id },
      data: {
        status: 'PREPARING',
      },
      include: {
        customer: {
          select: { id: true, name: true, phone: true },
        },
        store: {
          select: { id: true, name: true, address: true, city: true, pincode: true, phone: true, upiId: true },
        },
        items: true,
      },
    });

    logger.info(`Merchant started preparation for order: ${updatedOrder.orderNumber} for store: ${storeId}`);
    return formatMerchantOrder(updatedOrder);
  });
};

/**
 * Shopkeeper marks a preparing order as ready for customer pickup.
 * Transition: PREPARING -> READY_FOR_PICKUP.
 */
export const markOrderReadyForPickup = async ({ storeId, orderId }) => {
  if (!storeId || !isValidUuid(storeId) || !orderId || !isValidUuid(orderId)) {
    const error = new Error('Valid store ID and order ID are required');
    error.status = 400;
    throw error;
  }

  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findFirst({
      where: { id: orderId, storeId },
    });

    if (!order) {
      const error = new Error('Order not found or does not belong to your store');
      error.status = 404;
      throw error;
    }

    if (order.status !== 'PREPARING') {
      const error = new Error(
        `Cannot mark ready: order must be in PREPARING status (current status: ${order.status})`
      );
      error.status = 400;
      throw error;
    }

    const updatedOrder = await tx.order.update({
      where: { id: order.id },
      data: {
        status: 'READY_FOR_PICKUP',
        readyAt: new Date(),
      },
      include: {
        customer: {
          select: { id: true, name: true, phone: true },
        },
        store: {
          select: { id: true, name: true, address: true, city: true, pincode: true, phone: true, upiId: true },
        },
        items: true,
      },
    });

    logger.info(`Merchant marked order ready for pickup: ${updatedOrder.orderNumber} for store: ${storeId}`);
    return formatMerchantOrder(updatedOrder);
  });
};

/**
 * Records physical in-store payment (Cash or UPI) when order is READY_FOR_PICKUP.
 * Enforces rule: Payment can ONLY be recorded when the order is READY_FOR_PICKUP.
 */
export const recordOrderPayment = async ({ storeId, orderId, paymentMethod }) => {
  if (!storeId || !isValidUuid(storeId) || !orderId || !isValidUuid(orderId)) {
    const error = new Error('Valid store ID and order ID are required');
    error.status = 400;
    throw error;
  }

  if (!paymentMethod || !VALID_PAYMENT_METHODS.includes(paymentMethod)) {
    const error = new Error('Invalid payment method. Allowed values: CASH_ON_PICKUP, UPI_AT_STORE');
    error.status = 400;
    throw error;
  }

  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findFirst({
      where: { id: orderId, storeId },
    });

    if (!order) {
      const error = new Error('Order not found or does not belong to your store');
      error.status = 404;
      throw error;
    }

    if (order.status !== 'READY_FOR_PICKUP') {
      const error = new Error(
        `Cannot record payment: payment can only be recorded when the order is READY_FOR_PICKUP (current status: ${order.status})`
      );
      error.status = 400;
      throw error;
    }

    const updatedOrder = await tx.order.update({
      where: { id: order.id },
      data: {
        paymentStatus: 'PAID',
        paymentMethod,
      },
      include: {
        customer: {
          select: { id: true, name: true, phone: true },
        },
        store: {
          select: { id: true, name: true, address: true, city: true, pincode: true, phone: true, upiId: true },
        },
        items: true,
      },
    });

    logger.info(`Merchant recorded payment for order: ${updatedOrder.orderNumber} (Method: ${paymentMethod})`);
    return formatMerchantOrder(updatedOrder);
  });
};

/**
 * Marks order as COMPLETED after collection and payment.
 * Transition: READY_FOR_PICKUP -> COMPLETED.
 * Enforces rule: An order CANNOT become COMPLETED while unpaid!
 * Atomic operation: Validates order is READY_FOR_PICKUP, records payment and completes in one transaction.
 */
export const completeOrder = async ({ storeId, orderId, paymentMethod }) => {
  if (!storeId || !isValidUuid(storeId) || !orderId || !isValidUuid(orderId)) {
    const error = new Error('Valid store ID and order ID are required');
    error.status = 400;
    throw error;
  }

  return prisma.$transaction(async (tx) => {
    const order = await tx.order.findFirst({
      where: { id: orderId, storeId },
    });

    if (!order) {
      const error = new Error('Order not found or does not belong to your store');
      error.status = 404;
      throw error;
    }

    if (order.status !== 'READY_FOR_PICKUP') {
      const error = new Error(
        `Cannot complete order: order must be in READY_FOR_PICKUP status (current status: ${order.status})`
      );
      error.status = 400;
      throw error;
    }

    // Check payment status
    const effectivePaymentMethod = paymentMethod || order.paymentMethod;
    const isAlreadyPaid = order.paymentStatus === 'PAID';

    if (!isAlreadyPaid) {
      // If not already marked paid, merchant must provide or confirm paymentMethod to record payment atomically
      if (!paymentMethod || !VALID_PAYMENT_METHODS.includes(paymentMethod)) {
        const error = new Error(
          'Cannot complete order: payment has not been recorded. Please specify a valid payment method (CASH_ON_PICKUP or UPI_AT_STORE) to complete payment.'
        );
        error.status = 400;
        throw error;
      }
    }

    const updatedOrder = await tx.order.update({
      where: { id: order.id },
      data: {
        status: 'COMPLETED',
        completedAt: new Date(),
        paymentStatus: 'PAID',
        paymentMethod: effectivePaymentMethod,
      },
      include: {
        customer: {
          select: { id: true, name: true, phone: true },
        },
        store: {
          select: { id: true, name: true, address: true, city: true, pincode: true, phone: true, upiId: true },
        },
        items: true,
      },
    });

    logger.info(`Merchant completed order: ${updatedOrder.orderNumber} for store: ${storeId}`);
    return formatMerchantOrder(updatedOrder);
  });
};

/**
 * Compiles printable packing slip for an accepted order.
 * Strictly restricted to ACCEPTED, PREPARING, READY_FOR_PICKUP, or COMPLETED orders.
 */
export const getPackingSlipData = async ({ storeId, orderId }) => {
  if (!storeId || !isValidUuid(storeId) || !orderId || !isValidUuid(orderId)) {
    const error = new Error('Valid store ID and order ID are required');
    error.status = 400;
    throw error;
  }

  const order = await prisma.order.findFirst({
    where: { id: orderId, storeId },
    include: {
      customer: {
        select: { id: true, name: true, phone: true },
      },
      store: {
        select: {
          id: true,
          name: true,
          address: true,
          city: true,
          pincode: true,
          phone: true,
          upiId: true,
        },
      },
      items: true,
    },
  });

  if (!order) {
    const error = new Error('Order not found or does not belong to your store');
    error.status = 404;
    throw error;
  }

  if (order.status === 'PENDING_APPROVAL') {
    const error = new Error(
      'Packing slip is unavailable: order must be reviewed and accepted by shopkeeper first'
    );
    error.status = 400;
    throw error;
  }

  if (order.status === 'REJECTED') {
    const error = new Error('Packing slip cannot be generated for rejected orders');
    error.status = 400;
    throw error;
  }

  if (order.status === 'CANCELLED') {
    const error = new Error('Packing slip cannot be generated for cancelled orders');
    error.status = 400;
    throw error;
  }

  const paymentNote =
    order.paymentStatus === 'PAID'
      ? `PAYMENT RECEIVED — COLLECTED VIA ${order.paymentMethod === 'UPI_AT_STORE' ? 'UPI' : 'CASH'}`
      : 'PAYMENT PENDING — COLLECT AT STORE';

  return {
    packingSlipNumber: `PS-${order.orderNumber}`,
    branding: {
      appName: 'CallSaar',
      tagline: 'Kirana Voice Ordering & Store Pickup Platform',
    },
    store: {
      id: order.store.id,
      name: order.store.name,
      address: order.store.address,
      city: order.store.city,
      pincode: order.store.pincode,
      phone: order.store.phone,
      upiId: order.store.upiId || null,
    },
    customer: {
      id: order.customer.id,
      name: order.customer.name || 'Customer',
      phone: order.customer.phone || 'Not provided',
    },
    order: {
      id: order.id,
      orderNumber: order.orderNumber,
      createdAt: order.createdAt,
      acceptedAt: order.acceptedAt,
      readyAt: order.readyAt,
      completedAt: order.completedAt,
      status: order.status,
      paymentStatus: order.paymentStatus,
      paymentMethod: order.paymentMethod,
      notes: order.notes || null,
      subtotal: Number(order.subtotal).toFixed(2),
      paymentNote,
    },
    items: order.items.map((item) => ({
      id: item.id,
      productId: item.productId,
      productName: item.productName,
      quantity: Number(item.quantity).toString(),
      unit: item.unit,
      unitPrice: Number(item.unitPrice).toFixed(2),
      lineTotal: Number(item.lineTotal).toFixed(2),
    })),
    totalItems: order.items.length,
  };
};

export default {
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
};
