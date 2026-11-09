/**
 * Shopkeeper Authentication & Store Management Service
 * Handles password hashing, JWT creation, registration, and credential verification
 */

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/prisma.js';
import { config } from '../config/env.js';
import { logger } from '../utils/logger.js';

/**
 * Sanitizes a store record by stripping sensitive security credentials
 * @param {object} store - Raw Store model from database
 * @returns {object} Public store profile
 */
export const sanitizeStore = (store) => {
  if (!store) return null;
  // eslint-disable-next-line no-unused-vars
  const { passwordHash, ...safeStore } = store;
  return safeStore;
};

/**
 * Signs a cryptographically secure JWT token for an authenticated merchant
 * @param {object} store - Store record
 * @returns {string} Signed JWT token string
 */
export const generateToken = (store) => {
  return jwt.sign(
    {
      storeId: store.id,
      phone: store.phone,
      role: 'merchant',
    },
    config.jwtSecret,
    {
      expiresIn: config.jwtExpiresIn,
    }
  );
};

/**
 * Normalizes and validates Indian phone numbers (10 digits)
 * @param {string} phone
 * @returns {string} Clean 10-digit phone
 */
export const cleanPhoneNumber = (phone) => {
  if (!phone || typeof phone !== 'string') return '';
  // Strip all non-digit characters
  const digits = phone.replace(/\D/g, '');
  // If provided with country code (91), take the last 10 digits
  if (digits.length === 12 && digits.startsWith('91')) {
    return digits.slice(2);
  }
  return digits;
};

/**
 * Registers a new Kirana store with hashed merchant credentials
 * @param {object} data
 * @returns {Promise<{ store: object, token: string }>}
 */
export const registerStore = async (data) => {
  const {
    ownerName,
    phone,
    password,
    storeName,
    name,
    address,
    city,
    pincode,
    upiId,
  } = data || {};

  // 1. Validate required fields
  const cleanOwner = typeof ownerName === 'string' ? ownerName.trim() : '';
  const cleanPhone = cleanPhoneNumber(phone);
  const cleanStoreName = typeof (storeName || name) === 'string' ? (storeName || name).trim() : '';
  const cleanAddress = typeof address === 'string' ? address.trim() : '';
  const cleanCity = typeof city === 'string' ? city.trim() : '';
  const cleanPincode = typeof pincode === 'string' ? pincode.trim() : '';
  const cleanUpi = typeof upiId === 'string' ? upiId.trim() : null;

  if (!cleanOwner || cleanOwner.length < 2) {
    const error = new Error('Owner name is required (minimum 2 characters).');
    error.status = 400;
    throw error;
  }

  if (!cleanPhone || cleanPhone.length !== 10) {
    const error = new Error('A valid 10-digit mobile phone number is required.');
    error.status = 400;
    throw error;
  }

  if (!password || typeof password !== 'string' || password.length < 6) {
    const error = new Error('Password must be at least 6 characters in length.');
    error.status = 400;
    throw error;
  }

  if (!cleanStoreName || cleanStoreName.length < 2) {
    const error = new Error('Store name is required (minimum 2 characters).');
    error.status = 400;
    throw error;
  }

  if (!cleanAddress || cleanAddress.length < 3) {
    const error = new Error('Store address is required.');
    error.status = 400;
    throw error;
  }

  if (!cleanCity || cleanCity.length < 2) {
    const error = new Error('City is required.');
    error.status = 400;
    throw error;
  }

  if (!cleanPincode || !/^\d{6}$/.test(cleanPincode)) {
    const error = new Error('A valid 6-digit postal pincode is required.');
    error.status = 400;
    throw error;
  }

  // 2. Prevent duplicate phone registration
  const existing = await prisma.store.findUnique({
    where: { phone: cleanPhone },
  });

  if (existing) {
    const error = new Error('Phone number is already registered to an existing store. Please log in instead.');
    error.status = 409;
    throw error;
  }

  // 3. Hash password using bcrypt
  const saltRounds = 10;
  const passwordHash = await bcrypt.hash(password, saltRounds);

  // 4. Create Store record in database
  const createdStore = await prisma.store.create({
    data: {
      name: cleanStoreName,
      ownerName: cleanOwner,
      phone: cleanPhone,
      passwordHash,
      address: cleanAddress,
      city: cleanCity,
      pincode: cleanPincode,
      upiId: cleanUpi || null,
      isOpen: true,
    },
  });

  logger.info(`New store registered successfully: "${createdStore.name}" (ID: ${createdStore.id}, Phone: ${cleanPhone})`);

  // 5. Generate authentication token
  const token = generateToken(createdStore);

  return {
    store: sanitizeStore(createdStore),
    token,
  };
};

/**
 * Authenticates an existing merchant by mobile phone and password
 * @param {object} credentials
 * @returns {Promise<{ store: object, token: string }>}
 */
export const loginStore = async ({ phone, password }) => {
  const cleanPhone = cleanPhoneNumber(phone);

  if (!cleanPhone || !password) {
    const error = new Error('Mobile phone number and password are required.');
    error.status = 400;
    throw error;
  }

  // 1. Lookup store by phone
  const store = await prisma.store.findUnique({
    where: { phone: cleanPhone },
  });

  if (!store) {
    const error = new Error('Invalid mobile phone number or password.');
    error.status = 401;
    throw error;
  }

  // 2. Verify password hash using bcrypt
  const isMatch = await bcrypt.compare(password, store.passwordHash);
  if (!isMatch) {
    const error = new Error('Invalid mobile phone number or password.');
    error.status = 401;
    throw error;
  }

  logger.info(`Merchant logged in successfully: "${store.name}" (${store.id})`);

  // 3. Generate JWT
  const token = generateToken(store);

  return {
    store: sanitizeStore(store),
    token,
  };
};

/**
 * Retrieves safe store details by ID
 * @param {string} storeId
 * @returns {Promise<object|null>}
 */
export const getStoreById = async (storeId) => {
  if (!storeId) return null;
  const store = await prisma.store.findUnique({
    where: { id: storeId },
  });
  return sanitizeStore(store);
};

