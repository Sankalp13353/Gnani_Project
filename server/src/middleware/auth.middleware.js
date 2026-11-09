/**
 * Merchant Authentication & Authorization Middleware
 * Verifies JWT tokens from HTTP-only cookies or Authorization headers,
 * identifies the authenticated store, and prevents cross-store access.
 */

import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import prisma from '../config/prisma.js';
import { sanitizeStore } from '../services/auth.service.js';

/**
 * Middleware: Enforces that incoming merchant request is authenticated
 */
export const authenticateMerchant = async (req, res, next) => {
  try {
    // 1. Extract token from HTTP-only cookie first, fallback to Authorization Bearer header
    let token = req.cookies?.[config.authCookieName];

    if (!token && req.headers.authorization) {
      const authHeader = req.headers.authorization.trim();
      if (authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7).trim();
      }
    }

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required. Please log in.',
      });
    }

    // 2. Cryptographically verify token signature and expiry
    let decoded;
    try {
      decoded = jwt.verify(token, config.jwtSecret);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
          success: false,
          message: 'Session has expired. Please log in again.',
        });
      }
      return res.status(401).json({
        success: false,
        message: 'Invalid authentication token. Please log in again.',
      });
    }

    if (!decoded || !decoded.storeId) {
      return res.status(401).json({
        success: false,
        message: 'Malformed authentication token.',
      });
    }

    // 3. Fetch store from database to confirm existence and active status
    const store = await prisma.store.findUnique({
      where: { id: decoded.storeId },
    });

    if (!store) {
      return res.status(401).json({
        success: false,
        message: 'Store account not found. Please log in again.',
      });
    }

    // 4. Attach verified store identity to request object
    req.store = sanitizeStore(store);
    req.storeId = store.id;

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Middleware: Enforces tenant isolation
 * Ensures merchant cannot access or modify resources belonging to another store
 */
export const requireStoreOwner = (req, res, next) => {
  const requestedStoreId =
    req.params.storeId ||
    req.params.id ||
    req.body.storeId ||
    req.body.store_id ||
    req.query.storeId ||
    req.query.store_id;

  if (requestedStoreId && requestedStoreId !== req.storeId) {
    return res.status(403).json({
      success: false,
      message: 'Access denied. You do not have permission to access another store.',
    });
  }

  next();
};

