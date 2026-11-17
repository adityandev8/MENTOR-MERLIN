import { pino } from 'pino';
import { env } from '../config/env.js';

/** Structured JSON logs (one line per event) suitable for log aggregation. */
export const logger = pino({
  level: env.NODE_ENV === 'test' ? 'silent' : env.LOG_LEVEL,
  redact: { paths: ['req.headers.authorization', 'password', '*.password', '*.passwordHash'], remove: true },
  base: { service: 'hotel-api' },
});
