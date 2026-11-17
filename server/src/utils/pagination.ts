import type { PaginationMeta } from '@hotel/shared';

export interface PageParams {
  page: number;
  limit: number;
}

export function toSkip({ page, limit }: PageParams): number {
  return (page - 1) * limit;
}

export function buildMeta({ page, limit }: PageParams, total: number): PaginationMeta {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return {
    page,
    limit,
    total,
    totalPages,
    hasNextPage: page < totalPages,
    hasPrevPage: page > 1,
  };
}

/**
 * Builds a stable sort: the requested field first, then `_id` as a unique
 * tie-breaker so rows never shuffle between pages when the primary field ties.
 */
export function stableSort(field: string, order: 'asc' | 'desc'): Record<string, 1 | -1> {
  const dir = order === 'asc' ? 1 : -1;
  return { [field]: dir, _id: dir };
}

/** Escapes user input before it is used in an anchored, index-friendly prefix regex. */
export function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
