/**
 * Store Owner Authentication Controller
 * Handles registration, login, logout, and authenticated profile retrieval
 */

import { config } from '../config/env.js';
import { registerStore, loginStore } from '../services/auth.service.js';

/**
 * Returns security-hardened HTTP-only cookie configuration
 */
export const getAuthCookieOptions = () => ({
  httpOnly: true,
  secure: config.isProd,
  sameSite: config.isProd ? 'none' : 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: '/',
});

/**
 * POST /api/auth/register
 * Registers a new local store and merchant
 */
export const register = async (req, res, next) => {
  try {
    const result = await registerStore(req.body);

    // Set secure HTTP-only authentication cookie
    res.cookie(config.authCookieName, result.token, getAuthCookieOptions());

    return res.status(201).json({
      success: true,
      message: 'Store registered successfully',
      data: {
        token: result.token,
        store: result.store,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/login
 * Authenticates merchant by mobile phone and password
 */
export const login = async (req, res, next) => {
  try {
    const { phone, password } = req.body || {};
    const result = await loginStore({ phone, password });

    // Set secure HTTP-only authentication cookie
    res.cookie(config.authCookieName, result.token, getAuthCookieOptions());

    return res.status(200).json({
      success: true,
      message: 'Logged in successfully',
      data: {
        token: result.token,
        store: result.store,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/auth/logout
 * Clears authentication session cookie
 */
export const logout = async (req, res) => {
  res.clearCookie(config.authCookieName, {
    httpOnly: true,
    secure: config.isProd,
    sameSite: config.isProd ? 'none' : 'lax',
    path: '/',
  });

  return res.status(200).json({
    success: true,
    message: 'Logged out successfully',
  });
};

/**
 * GET /api/auth/me
 * Retrieves authenticated merchant store profile
 */
export const getMe = async (req, res) => {
  return res.status(200).json({
    success: true,
    data: {
      store: req.store,
    },
  });
};

