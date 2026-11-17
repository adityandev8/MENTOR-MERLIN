import type { ErrorRequestHandler, RequestHandler } from 'express';
import mongoose from 'mongoose';
import type { ApiErrorBody, ErrorCode } from '@hotel/shared';
import { AppError } from '../utils/AppError.js';
import { logger } from '../utils/logger.js';

export const notFoundHandler: RequestHandler = (req, _res, next) => {
  next(AppError.notFound(`No route for ${req.method} ${req.path}`));
};

function body(code: ErrorCode, message: string, requestId: string | undefined, details?: unknown): ApiErrorBody {
  return { success: false, error: { code, message, ...(details !== undefined ? { details } : {}), requestId } };
}

/** Maps every error to the shared error envelope. Unknown errors become opaque 500s. */
export const errorHandler: ErrorRequestHandler = (err: unknown, req, res, _next) => {
  const requestId = req.requestId;

  if (err instanceof AppError) {
    if (err.status >= 500) logger.warn({ requestId, code: err.code }, err.message);
    res.status(err.status).json(body(err.code, err.message, requestId, err.details));
    return;
  }
  // Malformed JSON body from express.json().
  if (err instanceof SyntaxError && 'body' in err) {
    res.status(400).json(body('VALIDATION_ERROR', 'Request body is not valid JSON', requestId));
    return;
  }
  if ((err as { type?: string }).type === 'entity.too.large') {
    res.status(413).json(body('VALIDATION_ERROR', 'Request body is too large', requestId));
    return;
  }
  if (err instanceof mongoose.Error.ValidationError) {
    const details = Object.values(err.errors).map((e) => ({ path: e.path, message: e.message }));
    res.status(400).json(body('VALIDATION_ERROR', 'Validation failed', requestId, details));
    return;
  }
  if (err instanceof mongoose.Error.CastError) {
    res.status(404).json(body('NOT_FOUND', 'Resource not found', requestId));
    return;
  }
  if ((err as { code?: number }).code === 11000) {
    res.status(409).json(body('CONFLICT', 'A record with these details already exists', requestId));
    return;
  }

  logger.error({ err, requestId, method: req.method, path: req.path }, 'unhandled error');
  res.status(500).json(body('INTERNAL_ERROR', 'Something went wrong. Please try again.', requestId));
};
