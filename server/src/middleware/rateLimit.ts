import { rateLimit, type Options } from 'express-rate-limit';
import type { ApiErrorBody } from '@hotel/shared';
import { env } from '../config/env.js';

/**
 * NOTE: the default store is in-process memory, so limits are per instance. Behind a load
 * balancer with N instances, swap in a shared store (e.g. rate-limit-redis) — see README.
 */
function limiter(windowMs: number, limit: number, { keyByUser = false, onlyFailures = false } = {}) {
  const options: Partial<Options> = {
    windowMs,
    limit,
    skipSuccessfulRequests: onlyFailures,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    skip: () => !env.RATE_LIMIT_ENABLED,
    handler: (req, res) => {
      const body: ApiErrorBody = {
        success: false,
        error: { code: 'RATE_LIMITED', message: 'Too many requests, please slow down.', requestId: req.requestId },
      };
      res.status(429).json(body);
    },
  };
  if (keyByUser) options.keyGenerator = (req) => req.auth?.userId ?? req.ip ?? 'anonymous';
  return rateLimit(options);
}

export const globalLimiter = limiter(60_000, 300);
/** Brute-force protection: only failed sign-ins / sign-ups count towards the limit. */
export const authLimiter = limiter(15 * 60_000, 20, { onlyFailures: true });
export const bookingLimiter = limiter(60_000, 20, { keyByUser: true });
