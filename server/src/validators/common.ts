import { z, type ZodType } from 'zod';
import { PAGINATION_DEFAULT_LIMIT, PAGINATION_MAX_LIMIT, SORT_ORDERS } from '@hotel/shared';
import { AppError } from '../utils/AppError.js';
import { isValidIsoDate } from '../domain/dates.js';

export const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Must be a valid id');

export const isoDate = z.string().refine(isValidIsoDate, 'Must be a valid date in YYYY-MM-DD format');

export const pageQuery = {
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(1).max(PAGINATION_MAX_LIMIT).default(PAGINATION_DEFAULT_LIMIT),
};

export const sortOrder = z.enum(SORT_ORDERS);

/** Query-string booleans: only explicit "true"/"1" are truthy. */
export const queryBool = z
  .enum(['true', 'false', '1', '0'])
  .optional()
  .transform((v) => v === 'true' || v === '1');

/** Empty query-string values (`?status=`) are treated as absent. */
export function optionalQuery<T extends ZodType>(schema: T) {
  return z.preprocess((v) => (v === '' ? undefined : v), schema.optional());
}

/**
 * Parses untrusted input with a schema. Throws a 400 with field-level details so the
 * client can show messages next to the right inputs.
 */
export function parse<T extends ZodType>(schema: T, input: unknown): z.infer<T> {
  const result = schema.safeParse(input);
  if (!result.success) {
    throw AppError.badRequest(
      'Request validation failed',
      result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    );
  }
  return result.data;
}
