import prisma from '../config/prisma.js';

/**
 * Product Service - Store-Scoped Catalogue Operations (Phase C1)
 *
 * Implements strict tenant-isolated catalogue management for authenticated kirana stores.
 * Every merchant query and mutation is strictly scoped by `storeId`.
 */

/**
 * Lists catalogue products belonging strictly to the authenticated store
 * Excludes soft-deleted products (isActive: false) by default.
 *
 * @param {object} params
 * @param {string} params.storeId - Authenticated store ID (required)
 * @param {string} [params.search] - Optional case-insensitive substring search in product name
 * @param {string} [params.category] - Optional category filter
 * @param {boolean} [params.isAvailable] - Optional availability filter
 * @param {number} [params.page=1] - Page number
 * @param {number} [params.limit=50] - Items per page
 * @param {number} [params.offset] - Optional manual offset override
 * @param {boolean} [params.includeInactive=false] - Whether to include soft-deleted products
 * @returns {Promise<{ products: Array, total: number, page: number, limit: number, totalPages: number }>}
 */
export const listStoreProducts = async ({
  storeId,
  search,
  category,
  isAvailable,
  page = 1,
  limit = 50,
  offset,
  includeInactive = false,
} = {}) => {
  if (!storeId) {
    const error = new Error('storeId is required for store catalogue operations');
    error.statusCode = 400;
    throw error;
  }

  const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
  const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);
  const skip = offset !== undefined ? Math.max(parseInt(offset, 10) || 0, 0) : (parsedPage - 1) * parsedLimit;

  const where = {
    storeId,
    ...(includeInactive ? {} : { isActive: true }),
    ...(category && {
      category: {
        equals: category.trim(),
        mode: 'insensitive',
      },
    }),
    ...(typeof isAvailable === 'boolean' && { isAvailable }),
    ...(search && {
      name: {
        contains: search.trim(),
        mode: 'insensitive',
      },
    }),
  };

  const [products, total] = await Promise.all([
    prisma.product.findMany({
      where,
      take: parsedLimit,
      skip,
      orderBy: { name: 'asc' },
    }),
    prisma.product.count({ where }),
  ]);

  return {
    products,
    total,
    page: parsedPage,
    limit: parsedLimit,
    totalPages: Math.ceil(total / parsedLimit) || 1,
  };
};

/**
 * Fetches a single product belonging strictly to the authenticated store
 *
 * @param {object} params
 * @param {string} params.id - Product UUID
 * @param {string} params.storeId - Authenticated store ID
 * @param {boolean} [params.includeInactive=false]
 * @returns {Promise<object|null>}
 */
export const getStoreProductById = async ({ id, storeId, includeInactive = false }) => {
  if (!id || !storeId) return null;

  return prisma.product.findFirst({
    where: {
      id,
      storeId,
      ...(includeInactive ? {} : { isActive: true }),
    },
  });
};

/**
 * Creates a new product belonging strictly to the authenticated store
 *
 * @param {object} params
 * @param {string} params.storeId - Authenticated store ID
 * @param {string} params.name - Product name
 * @param {string} [params.description] - Product description
 * @param {string} [params.category] - Product category
 * @param {string} [params.brand] - Product brand
 * @param {string} params.unit - Product unit
 * @param {string|number} params.price - Product price
 * @param {boolean} [params.isAvailable=true] - Availability status
 * @returns {Promise<object>} Created product record
 */
export const createStoreProduct = async ({
  storeId,
  name,
  description,
  category,
  brand,
  unit,
  price,
  isAvailable = true,
}) => {
  return prisma.product.create({
    data: {
      storeId,
      name: name.trim(),
      description: description ? description.trim() : null,
      category: category ? category.trim() : null,
      brand: brand ? brand.trim() : null,
      unit: unit.trim(),
      price,
      isAvailable: Boolean(isAvailable),
      isActive: true,
    },
  });
};

/**
 * Updates an existing product belonging strictly to the authenticated store
 *
 * @param {object} params
 * @param {string} params.id - Product UUID
 * @param {string} params.storeId - Authenticated store ID
 * @param {object} params.updateData - Validated fields to update
 * @returns {Promise<object|null>} Updated product record or null if not found
 */
export const updateStoreProduct = async ({ id, storeId, updateData }) => {
  const existing = await getStoreProductById({ id, storeId });
  if (!existing) {
    return null;
  }

  return prisma.product.update({
    where: { id: existing.id },
    data: updateData,
  });
};

/**
 * Soft-deletes a product belonging strictly to the authenticated store
 * Sets isActive: false and isAvailable: false without physical record removal.
 * Preserves historical OrderItem snapshots.
 *
 * @param {object} params
 * @param {string} params.id - Product UUID
 * @param {string} params.storeId - Authenticated store ID
 * @returns {Promise<object|null>} Soft-deleted product record or null if not found
 */
export const softDeleteStoreProduct = async ({ id, storeId }) => {
  const existing = await getStoreProductById({ id, storeId });
  if (!existing) {
    return null;
  }

  return prisma.product.update({
    where: { id: existing.id },
    data: {
      isActive: false,
      isAvailable: false,
    },
  });
};

// ============================================================================
// Legacy / Internal Helpers for Compatibility with Existing Phase A & 3 Tests
// ============================================================================

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
