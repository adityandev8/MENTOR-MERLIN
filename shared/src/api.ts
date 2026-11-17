/** API envelope and error contract used by every endpoint. */

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface ApiSuccess<T> {
  success: true;
  data: T;
  meta?: PaginationMeta;
}

export const ERROR_CODES = [
  'VALIDATION_ERROR',
  'UNAUTHENTICATED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'EMAIL_TAKEN',
  'INVALID_CREDENTIALS',
  'NO_AVAILABILITY',
  'CAPACITY_EXCEEDED',
  'ROOM_TYPE_INACTIVE',
  'INVALID_DATES',
  'INVALID_TRANSITION',
  'INVENTORY_BELOW_BOOKED',
  'IDEMPOTENCY_KEY_REUSED',
  'BUSY_RETRY',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];

export interface ApiErrorBody {
  success: false;
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
    requestId?: string;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiErrorBody;

export interface Paginated<T> {
  items: T[];
  meta: PaginationMeta;
}

export interface PageQuery {
  page?: number;
  limit?: number;
}
