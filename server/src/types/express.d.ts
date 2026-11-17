import type { Actor } from '../domain/lifecycle.js';

declare global {
  namespace Express {
    interface Request {
      /** Set by the authenticate middleware from a verified JWT. */
      auth?: Actor;
      requestId?: string;
    }
  }
}

export {};
