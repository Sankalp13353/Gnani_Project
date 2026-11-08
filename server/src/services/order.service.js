import prisma from '../config/prisma.js';

const DEFAULT_STORE_ID = '00000000-0000-0000-0000-000000000001';

/**
 * Order Service - Basic database operations
 */

export const createOrder = async ({
  orderNumber,
  storeId = DEFAULT_STORE_ID,
  customerId,
  status = 'PENDING_APPROVAL',
  paymentStatus = 'UNPAID',
  paymentMethod = 'CASH_ON_PICKUP',
  source = 'VOICE',
  subtotal,
  notes = null,
  rejectionReason = null,
  acceptedAt = null,
  readyAt = null,
  items = [],
}) => {
  return prisma.order.create({
    data: {
      orderNumber,
      storeId,
      customerId,
      status,
      paymentStatus,
      paymentMethod,
      source,
      subtotal,
      notes,
      rejectionReason,
      acceptedAt,
      readyAt,
      items: {
        create: items.map((item) => ({
          productId: item.productId || null,
          productName: item.productName,
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: item.unitPrice,
          lineTotal: item.lineTotal,
        })),
      },
    },
    include: {
      items: true,
      customer: true,
      store: true,
    },
  });
};

export const getOrderById = async (id) => {
  return prisma.order.findUnique({
    where: { id },
    include: {
      items: {
        include: {
          product: true,
        },
      },
      customer: true,
    },
  });
};

export const getOrderByNumber = async (orderNumber) => {
  return prisma.order.findUnique({
    where: { orderNumber },
    include: {
      items: true,
      customer: true,
    },
  });
};

export const listOrders = async ({
  storeId,
  customerId,
  status,
  limit = 20,
  offset = 0,
} = {}) => {
  const where = {
    ...(storeId && { storeId }),
    ...(customerId && { customerId }),
    ...(status && { status }),
  };

  return prisma.order.findMany({
    where,
    take: limit,
    skip: offset,
    orderBy: { createdAt: 'desc' },
    include: {
      customer: true,
      store: true,
      items: true,
    },
  });
};

export const countOrders = async (where = {}) => {
  return prisma.order.count({ where });
};

