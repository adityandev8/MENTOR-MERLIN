import { z } from 'zod';

/**
 * All configuration comes from environment variables and is validated once at
 * start-up so a misconfigured instance fails fast instead of at first request.
 */
const boolish = z
  .enum(['true', 'false', '1', '0'])
  .transform((v) => v === 'true' || v === '1');

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  MONGO_URI: z.string().min(1, 'MONGO_URI is required'),
  MONGO_MAX_POOL_SIZE: z.coerce.number().int().positive().default(20),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('12h'),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
  HOTEL_TIMEZONE: z.string().default('Asia/Kolkata'),
  HOTEL_CURRENCY: z.string().length(3).default('INR'),
  BOOKING_WINDOW_DAYS: z.coerce.number().int().min(1).max(730).default(365),
  MAX_STAY_NIGHTS: z.coerce.number().int().min(1).max(90).default(30),
  MAX_ROOMS_PER_BOOKING: z.coerce.number().int().min(1).max(20).default(5),
  AUTO_CONFIRM_BOOKINGS: boolish.default(false),
  TRUST_PROXY: boolish.default(false),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  RATE_LIMIT_ENABLED: boolish.default(true),
});

export type Env = z.infer<typeof EnvSchema>;

function loadEnv(): Env {
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${problems}`);
  }
  return parsed.data;
}

export const env: Env = loadEnv();
