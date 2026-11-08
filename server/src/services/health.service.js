import prisma from '../config/prisma.js';

/**
 * Basic API health check service
 */
export const getHealthStatus = () => {
  return {
    success: true,
    message: 'CallSaar API is running',
  };
};

/**
 * PostgreSQL Database health check service
 */
export const checkDatabaseHealth = async () => {
  // Execute a lightweight probe query
  await prisma.$queryRaw`SELECT 1`;
  return {
    success: true,
    database: 'connected',
  };
};
