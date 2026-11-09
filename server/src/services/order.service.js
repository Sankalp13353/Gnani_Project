import crypto from 'node:crypto';
import prisma from '../config/prisma.js';
import { sumDecimals, formatCurrency } from '../utils/decimal.js';
import { calculateUnitConversion } from '../utils/unitConverter.js';
import { isValidUuid } from '../utils/productValidation.js';
import { logger } from '../utils/logger.js';

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

/**
 * Calculates trusted order pricing, validates catalogue products against store,
 * performs unit conversion, and computes line totals using Decimal-safe arithmetic.
 *
 * @param {object} params
 * @param {string} params.storeId - Store UUID
 * @param {Array<object>} params.items - [{ productId, quantity, unit }]
 * @returns {Promise<object>} { store, items, subtotal }
 */
export const calculateOrderPricing = async ({ storeId, items }) => {
  if (!storeId || !isValidUuid(storeId)) {
    const error = new Error('A valid store ID is required');
    error.status = 400;
    throw error;
  }

  const store = await prisma.store.findUnique({
    where: { id: storeId },
    select: { id: true, name: true, isOpen: true, address: true, city: true, pincode: true },
  });

  if (!store) {
    const error = new Error('Store not found');
    error.status = 404;
    throw error;
  }

  if (!store.isOpen) {
    const error = new Error('Store is currently closed for orders');
    error.status = 400;
    throw error;
  }

  if (!items || !Array.isArray(items) || items.length === 0) {
    const error = new Error('Order items are required and must be a non-empty array');
    error.status = 400;
    throw error;
  }

  const calculatedItems = [];
  const lineTotals = [];

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const { productId, quantity, unit } = item;

    if (!productId || !isValidUuid(productId)) {
      const error = new Error(`Item ${i + 1}: Valid product ID is required`);
      error.status = 400;
      throw error;
    }

    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      const error = new Error(`Item ${i + 1}: Quantity must be a positive number`);
      error.status = 400;
      throw error;
    }

    // Query product strictly from database
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      const error = new Error(`Item ${i + 1}: Product not found`);
      error.status = 400;
      throw error;
    }

    if (product.storeId !== store.id) {
      const error = new Error(`Item ${i + 1}: Product "${product.name}" does not belong to the selected store`);
      error.status = 400;
      throw error;
    }

    if (!product.isActive) {
      const error = new Error(`Item ${i + 1}: Product "${product.name}" is no longer available in this store`);
      error.status = 400;
      throw error;
    }

    if (!product.isAvailable) {
      const error = new Error(`Item ${i + 1}: Product "${product.name}" is currently out of stock`);
      error.status = 400;
      throw error;
    }

    // Safely calculate unit conversion and line total
    const unitConversion = calculateUnitConversion({
      requestedQuantity: qty,
      requestedUnit: unit || product.unit,
      catalogUnit: product.unit,
      catalogPrice: product.price,
      productName: product.name,
    });

    if (unitConversion.status !== 'MATCHED' || !unitConversion.lineTotal) {
      const error = new Error(
        unitConversion.clarificationReason || `Item ${i + 1}: Invalid or unsupported unit "${unit}" for "${product.name}"`
      );
      error.status = 400;
      throw error;
    }

    const unitPrice = formatCurrency(product.price);
    const lineTotal = unitConversion.lineTotal;

    calculatedItems.push({
      productId: product.id,
      productName: product.name,
      quantity: String(qty),
      unit: unitConversion.resolvedUnit,
      catalogUnit: product.unit,
      unitPrice,
      lineTotal,
      conversionNote: unitConversion.conversionNote || null,
    });

    lineTotals.push(lineTotal);
  }

  const subtotal = sumDecimals(lineTotals);

  return {
    store: {
      id: store.id,
      name: store.name,
      address: store.address,
      city: store.city,
      pincode: store.pincode,
    },
    items: calculatedItems,
    subtotal,
  };
};

/**
 * Computes a deterministic SHA-256 hash of the canonical order request payload.
 * Used for idempotency payload verification (detects duplicate submissions with conflicting payloads).
 *
 * @param {object} params
 * @param {string} params.storeId - Store UUID
 * @param {string} [params.customerName] - Customer name
 * @param {string} [params.customerPhone] - Customer phone
 * @param {string} [params.notes] - Customer notes
 * @param {Array<object>} params.items - [{ productId, quantity, unit }]
 * @returns {string} Hex SHA-256 digest
 */
export const computeOrderPayloadHash = ({ storeId, customerName, customerPhone, notes, items }) => {
  const normalizedItems = (items || [])
    .map((it) => ({
      productId: String(it.productId || ''),
      quantity: String(it.quantity || ''),
      unit: String(it.unit || '').toLowerCase().trim(),
    }))
    .sort((a, b) => a.productId.localeCompare(b.productId));

  const canonicalPayload = JSON.stringify({
    storeId: String(storeId || ''),
    customerName: customerName ? String(customerName).trim() : '',
    customerPhone: customerPhone ? String(customerPhone).trim() : '',
    notes: notes ? String(notes).trim() : '',
    items: normalizedItems,
  });

  return crypto.createHash('sha256').update(canonicalPayload).digest('hex');
};

/**
 * Strips all merchant and customer private credentials from order object.
 * Strictly guarantees that customer phone numbers, merchant login phone, owner info,
 * UPI IDs, password hashes, and internal security token hashes are never leaked.
 *
 * @param {object} order - Raw Prisma Order record
 * @returns {object} Safe customer confirmation object
 */
export const sanitizeOrderOutput = (order) => ({
  id: order.id,
  orderNumber: order.orderNumber,
  storeId: order.storeId,
  status: order.status,
  paymentStatus: order.paymentStatus,
  paymentMethod: order.paymentMethod,
  source: order.source,
  subtotal: Number(order.subtotal).toFixed(2),
  notes: order.notes || null,
  createdAt: order.createdAt,
  store: {
    id: order.store?.id || order.storeId,
    name: order.store?.name || '',
    address: order.store?.address || '',
    city: order.store?.city || '',
    pincode: order.store?.pincode || '',
    // PRIVACY: phone, ownerName, upiId, passwordHash are NEVER included
  },
  customer: {
    name: order.customer?.name || null,
    // PRIVACY: customer phone is NEVER included
  },
  items: (order.items || []).map((item) => ({
    id: item.id,
    productId: item.productId,
    productName: item.productName,
    quantity: Number(item.quantity).toString(),
    unit: item.unit,
    unitPrice: Number(item.unitPrice).toFixed(2),
    lineTotal: Number(item.lineTotal).toFixed(2),
  })),
});

/**
 * Creates customer order atomically in a single Prisma transaction with duplicate submission idempotency.
 * Initial status: PENDING_APPROVAL, paymentStatus: UNPAID, paymentMethod: CASH_ON_PICKUP.
 *
 * @param {object} params
 * @param {string} params.storeId - Store UUID
 * @param {string} [params.customerName] - Customer name
 * @param {string} [params.customerPhone] - Customer phone
 * @param {string} [params.notes] - Customer pickup notes
 * @param {Array<object>} params.items - Validated items [{ productId, quantity, unit }]
 * @param {string} [params.idempotencyKey] - Unique key preventing duplicate submissions
 * @param {string} [params.confirmationToken] - Client-provided random secret for token recovery
 * @param {string} [params.source='VOICE'] - OrderSource enum
 * @returns {Promise<object>} { order, isDuplicate }
 */
export const createCustomerOrder = async ({
  storeId,
  customerName,
  customerPhone,
  notes,
  items,
  idempotencyKey,
  confirmationToken,
  source = 'VOICE',
}) => {
  // Validate storeId format
  if (!storeId || !isValidUuid(storeId)) {
    const error = new Error('A valid store ID is required');
    error.status = 400;
    throw error;
  }

  const cleanIdempotencyKey =
    idempotencyKey && typeof idempotencyKey === 'string' && idempotencyKey.trim().length > 0
      ? idempotencyKey.trim()
      : null;

  const cleanConfirmationToken =
    confirmationToken && typeof confirmationToken === 'string' && confirmationToken.trim().length > 0
      ? confirmationToken.trim()
      : null;

  const currentPayloadHash = cleanIdempotencyKey
    ? computeOrderPayloadHash({ storeId, customerName, customerPhone, notes, items })
    : null;

  // 1. If cleanIdempotencyKey is provided, check if order already exists for this store
  if (cleanIdempotencyKey) {
    const existingOrder = await prisma.order.findUnique({
      where: {
        storeId_idempotencyKey: {
          storeId,
          idempotencyKey: cleanIdempotencyKey,
        },
      },
      include: {
        store: {
          select: { id: true, name: true, address: true, city: true, pincode: true },
        },
        items: true,
        customer: {
          select: { name: true },
        },
      },
    });

    if (existingOrder) {
      // Verify payload hash equality: Same key + different payload = HTTP 409 Conflict
      if (existingOrder.payloadHash && existingOrder.payloadHash !== currentPayloadHash) {
        const conflictError = new Error(
          `Idempotency conflict: key "${cleanIdempotencyKey}" was previously used for store "${storeId}" with a different order payload.`
        );
        conflictError.status = 409;
        throw conflictError;
      }

      // Verify confirmation secret if order has a token hash and client provided a token
      if (existingOrder.confirmationTokenHash && cleanConfirmationToken) {
        const clientHash = crypto.createHash('sha256').update(cleanConfirmationToken).digest('hex');
        if (clientHash !== existingOrder.confirmationTokenHash) {
          const conflictError = new Error(
            `Idempotency conflict: confirmation secret does not match original order for key "${cleanIdempotencyKey}".`
          );
          conflictError.status = 409;
          throw conflictError;
        }
      }

      logger.info(`Idempotent order request matched for key: ${cleanIdempotencyKey}, returning existing order: ${existingOrder.orderNumber}`);
      const sanitized = sanitizeOrderOutput(existingOrder);
      return {
        order: {
          ...sanitized,
          ...(cleanConfirmationToken ? { confirmationToken: cleanConfirmationToken } : {}),
        },
        isDuplicate: true,
      };
    }
  }

  // 2. Validate store and calculate trusted pricing directly from PostgreSQL catalogue
  const pricingResult = await calculateOrderPricing({ storeId, items });
  const { store, items: validatedItems, subtotal } = pricingResult;

  // Generate or use unguessable customer confirmation access token (64 hex characters)
  const finalConfirmationToken = cleanConfirmationToken || crypto.randomBytes(32).toString('hex');
  const confirmationTokenHash = crypto.createHash('sha256').update(finalConfirmationToken).digest('hex');

  // 3. Atomically persist Customer, Order, and OrderItems inside a single transaction
  try {
    const order = await prisma.$transaction(async (tx) => {
      // 3a. Find or create Customer record
      let customerId;
      const cleanPhone = customerPhone && typeof customerPhone === 'string' ? customerPhone.trim() : null;
      const cleanName = customerName && typeof customerName === 'string' ? customerName.trim() : null;

      if (cleanPhone) {
        let existingCustomer = await tx.customer.findFirst({
          where: { phone: cleanPhone },
        });
        if (existingCustomer) {
          if (cleanName && !existingCustomer.name) {
            existingCustomer = await tx.customer.update({
              where: { id: existingCustomer.id },
              data: { name: cleanName },
            });
          }
          customerId = existingCustomer.id;
        } else {
          const newCustomer = await tx.customer.create({
            data: {
              name: cleanName || null,
              phone: cleanPhone,
            },
          });
          customerId = newCustomer.id;
        }
      } else {
        const guestCustomer = await tx.customer.create({
          data: {
            name: cleanName || 'Customer',
            phone: null,
          },
        });
        customerId = guestCustomer.id;
      }

      // 3b. Generate unique Order Number: e.g. ORD-20261109-A3F9X
      const datePrefix = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const randSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
      const orderNumber = `ORD-${datePrefix}-${randSuffix}`;

      // 3c. Create Order record with distinct system UUID for Order.id
      const createdOrder = await tx.order.create({
        data: {
          orderNumber,
          storeId: store.id,
          customerId,
          idempotencyKey: cleanIdempotencyKey,
          payloadHash: currentPayloadHash,
          confirmationTokenHash,
          status: 'PENDING_APPROVAL',
          paymentStatus: 'UNPAID',
          paymentMethod: 'CASH_ON_PICKUP',
          source: source === 'MANUAL' ? 'MANUAL' : 'VOICE',
          subtotal,
          notes: notes && typeof notes === 'string' ? notes.trim() : null,
          items: {
            create: validatedItems.map((item) => ({
              productId: item.productId,
              productName: item.productName,
              quantity: item.quantity,
              unit: item.unit,
              unitPrice: item.unitPrice,
              lineTotal: item.lineTotal,
            })),
          },
        },
        include: {
          store: {
            select: { id: true, name: true, address: true, city: true, pincode: true },
          },
          customer: {
            select: { name: true },
          },
          items: true,
        },
      });

      return createdOrder;
    });

    logger.info(`Customer order created: ${order.orderNumber} (ID: ${order.id}) for store "${store.name}"`);
    const sanitized = sanitizeOrderOutput(order);
    return {
      order: {
        ...sanitized,
        confirmationToken: finalConfirmationToken, // Passed to client at creation time, never stored unhashed or logged
      },
      isDuplicate: false,
    };
  } catch (err) {
    // If concurrent race condition violated unique constraint on (storeId, idempotencyKey)
    const isIdempotencyCollision =
      err.code === 'P2002' &&
      cleanIdempotencyKey &&
      (err.meta?.target?.includes('idempotencyKey') ||
        err.meta?.target?.includes('orders_storeId_idempotencyKey_key') ||
        String(err.meta?.target).includes('idempotencyKey'));

    if (isIdempotencyCollision) {
      const existing = await prisma.order.findUnique({
        where: {
          storeId_idempotencyKey: {
            storeId,
            idempotencyKey: cleanIdempotencyKey,
          },
        },
        include: {
          store: {
            select: { id: true, name: true, address: true, city: true, pincode: true },
          },
          items: true,
          customer: {
            select: { name: true },
          },
        },
      });

      if (existing) {
        if (existing.payloadHash && existing.payloadHash !== currentPayloadHash) {
          const conflictError = new Error(
            `Idempotency conflict: key "${cleanIdempotencyKey}" was previously used for store "${storeId}" with a different order payload.`
          );
          conflictError.status = 409;
          throw conflictError;
        }

        if (existing.confirmationTokenHash && cleanConfirmationToken) {
          const clientHash = crypto.createHash('sha256').update(cleanConfirmationToken).digest('hex');
          if (clientHash !== existing.confirmationTokenHash) {
            const conflictError = new Error(
              `Idempotency conflict: confirmation secret does not match original order for key "${cleanIdempotencyKey}".`
            );
            conflictError.status = 409;
            throw conflictError;
          }
        }

        const sanitized = sanitizeOrderOutput(existing);
        return {
          order: {
            ...sanitized,
            ...(cleanConfirmationToken ? { confirmationToken: cleanConfirmationToken } : {}),
          },
          isDuplicate: true,
        };
      }
    }

    // Unrelated uniqueness error (e.g. orderNumber collision) or other error -> rethrow
    throw err;
  }
};

/**
 * Retrieve public customer order details by ID for the confirmation page.
 * Strictly guarantees that customer phone numbers, merchant login phone, owner info,
 * UPI IDs, password hashes, and internal security token hashes are never leaked.
 *
 * @param {string} orderId - Order UUID
 * @param {string} [confirmationToken] - Optional customer access token
 * @returns {Promise<object>} Order with sanitized items, store details, and customer info
 */
export const getCustomerOrderById = async (orderId, confirmationToken = null) => {
  if (!orderId || !isValidUuid(orderId)) {
    const error = new Error('Invalid order ID format');
    error.status = 400;
    throw error;
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      store: {
        select: {
          id: true,
          name: true,
          address: true,
          city: true,
          pincode: true,
          // STRICT PRIVACY: phone, ownerName, upiId, passwordHash are EXCLUDED
        },
      },
      customer: {
        select: {
          name: true,
          // STRICT PRIVACY: customer phone is EXCLUDED
        },
      },
      items: {
        select: {
          id: true,
          productId: true,
          productName: true,
          quantity: true,
          unit: true,
          unitPrice: true,
          lineTotal: true,
        },
      },
    },
  });

  if (!order) {
    const error = new Error('Order not found');
    error.status = 404;
    throw error;
  }

  // If a confirmation token is supplied and the order was created with one, verify it
  if (confirmationToken && order.confirmationTokenHash) {
    const tokenHash = crypto.createHash('sha256').update(confirmationToken.trim()).digest('hex');
    if (tokenHash !== order.confirmationTokenHash) {
      const error = new Error('Invalid or unauthorized confirmation access token');
      error.status = 403;
      throw error;
    }
  }

  return sanitizeOrderOutput(order);
};

