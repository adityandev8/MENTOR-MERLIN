import type { ErrorCode } from '@hotel/shared';

/**
 * An expected, client-facing error. Anything thrown that is NOT an AppError is
 * treated as an unexpected 500 and its message is never leaked to clients.
 */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }

  static badRequest(message: string, details?: unknown, code: ErrorCode = 'VALIDATION_ERROR'): AppError {
    return new AppError(400, code, message, details);
  }
  static unauthenticated(message = 'Authentication required'): AppError {
    return new AppError(401, 'UNAUTHENTICATED', message);
  }
  static forbidden(message = 'You do not have permission to perform this action'): AppError {
    return new AppError(403, 'FORBIDDEN', message);
  }
  static notFound(message = 'Resource not found'): AppError {
    return new AppError(404, 'NOT_FOUND', message);
  }
  static conflict(code: ErrorCode, message: string, details?: unknown): AppError {
    return new AppError(409, code, message, details);
  }
  static unprocessable(code: ErrorCode, message: string, details?: unknown): AppError {
    return new AppError(422, code, message, details);
  }
}
