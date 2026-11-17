import { createApp } from './app.js';
import { env } from './config/env.js';
import { connectDatabase, disconnectDatabase } from './db/connection.js';
import { logger } from './utils/logger.js';

async function main(): Promise<void> {
  await connectDatabase();
  const app = createApp();
  const server = app.listen(env.PORT, () => logger.info({ port: env.PORT }, 'API listening'));

  // Bound slow clients so they can't hold connections indefinitely.
  server.requestTimeout = 30_000;
  server.headersTimeout = 35_000;
  server.keepAliveTimeout = 65_000; // > typical load-balancer idle timeout (60 s)

  // Graceful shutdown: stop accepting, let in-flight requests (and their transactions) finish.
  let shuttingDown = false;
  const shutdown = (signal: string): void => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'shutting down');
    const force = setTimeout(() => process.exit(1), 15_000).unref();
    server.close(async () => {
      await disconnectDatabase();
      clearTimeout(force);
      process.exit(0);
    });
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => logger.error({ reason }, 'unhandled promise rejection'));
}

main().catch((error: unknown) => {
  logger.fatal({ err: error }, 'failed to start');
  process.exit(1);
});
