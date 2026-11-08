import prisma from '../config/prisma.js';

/**
 * Customer Service - Basic database operations
 */

export const createCustomer = async ({ name, phone }) => {
  return prisma.customer.create({
    data: {
      name: name || null,
      phone: phone || null,
    },
  });
};

export const getCustomerById = async (id) => {
  return prisma.customer.findUnique({
    where: { id },
    include: {
      orders: {
        take: 5,
        orderBy: { createdAt: 'desc' },
      },
    },
  });
};

export const getCustomerByPhone = async (phone) => {
  if (!phone) return null;
  return prisma.customer.findFirst({
    where: { phone },
  });
};

export const listCustomers = async ({ limit = 20, offset = 0 } = {}) => {
  return prisma.customer.findMany({
    take: limit,
    skip: offset,
    orderBy: { createdAt: 'desc' },
  });
};

export const countCustomers = async () => {
  return prisma.customer.count();
};

