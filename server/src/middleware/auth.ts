import type { NextFunction, Request, RequestHandler, Response } from 'express';
import type { Role } from '@hotel/shared';
import { verifyToken } from '../services/auth.service.js';
import { AppError } from '../utils/AppError.js';
import type { Actor } from '../domain/lifecycle.js';

function bearerToken(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header) return null;
  const [scheme, token] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && token ? token : null;
}

/** Requires a valid token. Identity and role come only from the signed token. */
export const authenticate: RequestHandler = (req: Request, _res: Response, next: NextFunction) => {
  const token = bearerToken(req);
  if (!token) return next(AppError.unauthenticated());
  req.auth = verifyToken(token);
  next();
};

/** Attaches identity if a valid token is present; anonymous otherwise. Invalid tokens are rejected. */
export const optionalAuth: RequestHandler = (req, _res, next) => {
  const token = bearerToken(req);
  if (token) req.auth = verifyToken(token);
  next();
};

export function requireRole(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.auth) return next(AppError.unauthenticated());
    if (!roles.includes(req.auth.role)) return next(AppError.forbidden());
    next();
  };
}

/** Narrowing helper for controllers mounted behind `authenticate`. */
export function actorOf(req: Request): Actor {
  if (!req.auth) throw AppError.unauthenticated();
  return req.auth;
}
