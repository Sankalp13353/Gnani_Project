import { logger } from '../utils/logger.js';
import { config } from '../config/env.js';

/**
 * Centralised error handling middleware
 */
export const errorHandler = (err, req, res, next) => {
  const statusCode = err.status || err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  logger.error(`${statusCode} - ${message} - ${req.method} ${req.originalUrl}`, err.stack);

  res.status(statusCode).json({
    success: false,
    message,
    ...(config.isDev && { stack: err.stack })
  });
};

