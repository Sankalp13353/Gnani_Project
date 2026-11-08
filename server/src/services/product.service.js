import prisma from '../config/prisma.js';

/**
 * Product Service - Catalogue read and query operations
 */

export const listActiveProducts = async ({ storeId, category, search, limit = 50, offset = 0 } = {}) => {
  const where = {
    isActive: true,
    ...(storeId && { storeId }),
    ...(category && { category }),
    ...(search && {
      name: {
        contains: search,
        mode: 'insensitive',
      },
    }),
  };

  return prisma.product.findMany({
    where,
    take: limit,
    skip: offset,
    orderBy: { name: 'asc' },
  });
};

export const getProductById = async (id) => {
  return prisma.product.findUnique({
    where: { id },
  });
};

export const getProductByName = async (name) => {
  return prisma.product.findFirst({
    where: {
      name: {
        equals: name,
        mode: 'insensitive',
      },
    },
  });
};

export const countProducts = async (where = {}) => {
  return prisma.product.count({ where });
};

