import app from './app.js';
import { config } from './config/env.js';
import { logger } from './utils/logger.js';
import { disconnectPrisma } from './config/prisma.js';

const PORT = config.port;

const server = app.listen(PORT, () => {
  logger.info(`CallSaar Server running in ${config.nodeEnv} mode on port ${PORT}`);
  logger.info(`Health check available at http://localhost:${PORT}/api/health`);
  logger.info(`Database health check available at http://localhost:${PORT}/api/health/db`);
});

// Handle graceful shutdown
const shutdown = (signal) => {
  logger.info(`${signal} received. Closing HTTP server gracefully...`);
  server.close(async () => {
    logger.info('HTTP server closed.');
    await disconnectPrisma();
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default server;

