import prisma from '../config/prisma.js';
import { parseAvailability } from '../utils/productValidation.js';

/**
 * Store Service - Customer-Facing Public Store Discovery & Public Catalogue (Phase D)
 *
 * Implements public store discovery and store-scoped public catalogue browsing.
 * Guarantees zero leakage of private merchant credentials (passwordHash, owner phone, upiId).
 * Strictly enforces tenant isolation: never falls back to DEFAULT_STORE_ID.
 */

// Public Store attributes safely exposed to customer clients
const PUBLIC_STORE_SELECT = {
  id: true,
  name: true,
  address: true,
  city: true,
  pincode: true,
  isOpen: true,
  createdAt: true,
};

// Public Product attributes safely exposed in customer catalogue
const PUBLIC_PRODUCT_SELECT = {
  id: true,
  storeId: true,
  name: true,
  brand: true,
  category: true,
  description: true,
  unit: true,
  price: true,
  isAvailable: true,
};

/**
 * Lists public stores with search and location filtering
 *
 * @param {object} params
 * @param {string} [params.search] - Store name substring search
 * @param {string} [params.city] - Store city filter
 * @param {string} [params.pincode] - Store postal pincode filter
 * @param {boolean|string} [params.isOpen] - Store open/closed filter
 * @param {number} [params.page=1] - Page number
 * @param {number} [params.limit=20] - Stores per page
 * @returns {Promise<{ stores: Array, total: number, page: number, limit: number, totalPages: number }>}
 */
export const listPublicStores = async ({
  search,
  city,
  pincode,
  isOpen,
  page = 1,
  limit = 20,
} = {}) => {
  const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
  const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);
  const skip = (parsedPage - 1) * parsedLimit;

  let parsedIsOpen;
  if (isOpen !== undefined && isOpen !== null && isOpen !== '') {
    try {
      parsedIsOpen = parseAvailability(isOpen);
    } catch {
      // Ignore invalid isOpen filter value
    }
  }

  const where = {
    ...(search && {
      name: {
        contains: search.trim(),
        mode: 'insensitive',
      },
    }),
    ...(city && {
      city: {
        equals: city.trim(),
        mode: 'insensitive',
      },
    }),
    ...(pincode && {
      pincode: {
        startsWith: pincode.trim(),
      },
    }),
    ...(typeof parsedIsOpen === 'boolean' && { isOpen: parsedIsOpen }),
  };

  const [stores, total] = await Promise.all([
    prisma.store.findMany({
      where,
      select: PUBLIC_STORE_SELECT,
      take: parsedLimit,
      skip,
      orderBy: { name: 'asc' },
    }),
    prisma.store.count({ where }),
  ]);

  return {
    stores,
    total,
    page: parsedPage,
    limit: parsedLimit,
    totalPages: Math.ceil(total / parsedLimit) || 1,
  };
};

/**
 * Retrieves public details for a single store by ID
 *
 * @param {string} storeId - Store UUID
 * @returns {Promise<object|null>} Sanitized public store profile or null
 */
export const getPublicStoreById = async (storeId) => {
  if (!storeId) return null;

  return prisma.store.findUnique({
    where: { id: storeId },
    select: PUBLIC_STORE_SELECT,
  });
};

/**
 * Retrieves public catalogue products strictly scoped to the requested store
 * Excludes soft-deleted products (isActive: false) and out-of-stock items (isAvailable: false).
 * Never uses DEFAULT_STORE_ID fallback.
 *
 * @param {object} params
 * @param {string} params.storeId - Store UUID
 * @param {string} [params.search] - Product name search substring
 * @param {string} [params.category] - Category filter
 * @param {number} [params.page=1] - Page number
 * @param {number} [params.limit=24] - Products per page
 * @returns {Promise<{ storeNotFound?: boolean, store?: object, products?: Array, total?: number, page?: number, limit?: number, totalPages?: number }>}
 */
export const getPublicStoreCatalogue = async ({
  storeId,
  search,
  category,
  page = 1,
  limit = 24,
}) => {
  if (!storeId) {
    return { storeNotFound: true };
  }

  // 1. Verify store existence
  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: PUBLIC_STORE_SELECT,
  });

  if (!store) {
    return { storeNotFound: true };
  }

  // 2. Query public available products strictly for this storeId
  const parsedPage = Math.max(parseInt(page, 10) || 1, 1);
  const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 24, 1), 100);
  const skip = (parsedPage - 1) * parsedLimit;

  const where = {
    storeId,
    isActive: true,
    isAvailable: true,
    ...(search && {
      name: {
        contains: search.trim(),
        mode: 'insensitive',
      },
    }),
    ...(category && {
      category: {
        equals: category.trim(),
        mode: 'insensitive',
      },
    }),
  };

  const [rawProducts, total] = await Promise.all([
    prisma.product.findMany({
      where,
      select: PUBLIC_PRODUCT_SELECT,
      take: parsedLimit,
      skip,
      orderBy: { name: 'asc' },
    }),
    prisma.product.count({ where }),
  ]);

  // Format Decimal prices safely
  const products = rawProducts.map((p) => ({
    ...p,
    price: Number(p.price).toFixed(2),
  }));

  return {
    store,
    products,
    total,
    page: parsedPage,
    limit: parsedLimit,
    totalPages: Math.ceil(total / parsedLimit) || 1,
  };
};

