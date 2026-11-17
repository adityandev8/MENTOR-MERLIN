import { z } from 'zod';
import { FRONT_DESK_VIEWS, RESERVATION_ACTIONS, RESERVATION_SORT_FIELDS, RESERVATION_STATUSES } from '@hotel/shared';
import { env } from '../config/env.js';
import { isoDate, objectId, optionalQuery, pageQuery, sortOrder } from './common.js';

const guests = z.number().int().min(1).max(100);
const rooms = z.number().int().min(1).max(env.MAX_ROOMS_PER_BOOKING);

/**
 * Note what is NOT accepted: price, total, status, owner. `.strict()` rejects them
 * outright so a tampered client gets a clear 400 instead of being silently ignored.
 */
export const createReservationSchema = z
  .object({
    roomTypeId: objectId,
    checkIn: isoDate,
    checkOut: isoDate,
    guests,
    rooms: rooms.default(1),
  })
  .strict();

export const reservationActionSchema = z
  .object({
    action: z.enum(RESERVATION_ACTIONS),
    note: z.string().trim().max(500).optional(),
  })
  .strict();

export const stayQuerySchema = z.object({
  checkIn: isoDate,
  checkOut: isoDate,
  guests: z.coerce.number().pipe(guests),
  rooms: optionalQuery(z.coerce.number().pipe(rooms)).transform((v) => v ?? 1),
});

export const availabilityQuerySchema = stayQuerySchema.extend(pageQuery);

export const reservationListQuery = z.object({
  ...pageQuery,
  status: optionalQuery(z.enum(RESERVATION_STATUSES)),
  q: optionalQuery(z.string().trim().min(1).max(100)),
  roomTypeId: optionalQuery(objectId),
  checkInFrom: optionalQuery(isoDate),
  checkInTo: optionalQuery(isoDate),
  stayDate: optionalQuery(isoDate),
  sortBy: optionalQuery(z.enum(RESERVATION_SORT_FIELDS)).transform((v) => v ?? 'createdAt'),
  sortOrder: optionalQuery(sortOrder).transform((v) => v ?? 'desc'),
});

export const frontDeskQuery = z.object({
  ...pageQuery,
  view: z.enum(FRONT_DESK_VIEWS).default('arrivals'),
});

export const idempotencyKeySchema = z.string().trim().min(8).max(100).regex(/^[\w-]+$/, 'Invalid Idempotency-Key');
