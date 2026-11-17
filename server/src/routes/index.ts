import { Router } from 'express';
import * as auth from '../controllers/auth.controller.js';
import * as roomTypes from '../controllers/roomType.controller.js';
import * as availability from '../controllers/availability.controller.js';
import * as reservations from '../controllers/reservation.controller.js';
import * as admin from '../controllers/admin.controller.js';
import { authenticate, optionalAuth, requireRole } from '../middleware/auth.js';
import { authLimiter, bookingLimiter } from '../middleware/rateLimit.js';

const staffOnly = [authenticate, requireRole('STAFF', 'ADMIN')];

export function apiRouter(): Router {
  const router = Router();

  // Auth
  router.post('/auth/register', authLimiter, auth.register);
  router.post('/auth/login', authLimiter, auth.login);
  router.get('/auth/me', authenticate, auth.me);

  // Room types (public read, staff write)
  router.get('/room-types', optionalAuth, roomTypes.list);
  router.get('/room-types/:id', optionalAuth, roomTypes.getById);
  router.get('/room-types/:id/quote', roomTypes.quote);
  router.post('/room-types', ...staffOnly, roomTypes.create);
  router.patch('/room-types/:id', ...staffOnly, roomTypes.update);

  // Availability search (public)
  router.get('/availability', availability.search);

  // Reservations (ownership enforced in the service layer)
  router.post('/reservations', authenticate, requireRole('GUEST'), bookingLimiter, reservations.create);
  router.get('/reservations', authenticate, reservations.list);
  router.get('/reservations/:id', authenticate, reservations.getById);
  router.post('/reservations/:id/actions', authenticate, reservations.action);

  // Staff operations
  router.get('/admin/dashboard', ...staffOnly, admin.dashboard);
  router.get('/admin/front-desk', ...staffOnly, admin.frontDesk);

  return router;
}
