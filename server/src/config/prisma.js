import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger.js';

// Singleton pattern to prevent duplicate connections during hot-reloading in development
const globalForPrisma = globalThis;

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['warn', 'error']
        : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

/**
 * Gracefully disconnect Prisma client from the database
 */
export const disconnectPrisma = async () => {
  try {
    await prisma.$disconnect();
    logger.info('Prisma client disconnected successfully.');
  } catch (error) {
    logger.error('Error disconnecting Prisma client:', error);
  }
};

export default prisma;

