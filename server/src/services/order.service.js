import prisma from '../config/prisma.js';

/**
 * Order Service - Basic database operations
 */

export const createOrder = async ({
  orderNumber,
  customerId,
  status = 'PENDING_CONFIRMATION',
  source = 'VOICE',
  subtotal,
  notes = null,
  items = [],
}) => {
  return prisma.order.create({
    data: {
      orderNumber,
      customerId,
      status,
      source,
      subtotal,
      notes,
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
  customerId,
  status,
  limit = 20,
  offset = 0,
} = {}) => {
  const where = {
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
      items: true,
    },
  });
};

export const countOrders = async (where = {}) => {
  return prisma.order.count({ where });
};

