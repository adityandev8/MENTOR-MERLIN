import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import { apiRouter } from './routes/index.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { httpLogger, requestId } from './middleware/requestContext.js';
import { globalLimiter } from './middleware/rateLimit.js';
import { isDatabaseReady, pingDatabase } from './db/connection.js';
import { sendOk } from './utils/http.js';

/** Builds the Express app without listening, so tests can drive it with supertest. */
export function createApp(): Express {
  const app = express();
  app.disable('x-powered-by');
  if (env.TRUST_PROXY) app.set('trust proxy', 1);

  app.use(requestId);
  app.use(httpLogger);
  app.use(helmet());
  app.use(cors({ origin: env.CLIENT_ORIGIN.split(',').map((o) => o.trim()), exposedHeaders: ['X-Request-Id'] }));
  app.use(express.json({ limit: '100kb' }));

  // Liveness: the process is up. Readiness: it can serve traffic (DB reachable).
  app.get('/health/live', (_req, res) => sendOk(res, { status: 'ok' }));
  app.get('/health/ready', async (_req, res) => {
    const ok = isDatabaseReady() && (await pingDatabase());
    res.status(ok ? 200 : 503).json({ success: ok, data: { status: ok ? 'ready' : 'unavailable' } });
  });

  app.use('/api', globalLimiter, apiRouter());
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
