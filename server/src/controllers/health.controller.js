import { getHealthStatus, checkDatabaseHealth } from '../services/health.service.js';
import { logger } from '../utils/logger.js';

/**
 * Controller to handle GET /api/health
 */
export const checkHealth = (req, res, next) => {
  try {
    const health = getHealthStatus();
    return res.status(200).json(health);
  } catch (error) {
    next(error);
  }
};

/**
 * Controller to handle GET /api/health/db
 */
export const checkDbHealth = async (req, res) => {
  try {
    const health = await checkDatabaseHealth();
    return res.status(200).json(health);
  } catch (error) {
    logger.error('Database health check failed:', error.message);
    return res.status(503).json({
      success: false,
      database: 'disconnected',
      message: 'Database service is unavailable',
    });
  }
};
