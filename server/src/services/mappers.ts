import type { IsoDate, PublicUser, ReservationDTO, RoomTypeDTO } from '@hotel/shared';
import type { UserDoc } from '../models/user.model.js';
import type { RoomTypeDoc } from '../models/roomType.model.js';
import type { ReservationDoc } from '../models/reservation.model.js';
import { utcDateToIso } from '../domain/dates.js';
import { allowedActions, type Actor } from '../domain/lifecycle.js';
import { env } from '../config/env.js';

/** Persistence → API contract. Internal fields (password hashes, idempotency keys) never leave here. */

export function toPublicUser(u: Pick<UserDoc, '_id' | 'name' | 'email' | 'role' | 'createdAt'>): PublicUser {
  return { id: u._id.toString(), name: u.name, email: u.email, role: u.role, createdAt: u.createdAt.toISOString() };
}

export function toRoomTypeDTO(rt: RoomTypeDoc): RoomTypeDTO {
  return {
    id: rt._id.toString(),
    name: rt.name,
    description: rt.description,
    capacity: rt.capacity,
    facilities: rt.facilities,
    pricePerNight: rt.pricePerNight,
    currency: env.HOTEL_CURRENCY,
    totalInventory: rt.totalInventory,
    isActive: rt.isActive,
    imageUrl: rt.imageUrl ?? null,
    createdAt: rt.createdAt.toISOString(),
    updatedAt: rt.updatedAt.toISOString(),
  };
}

export function toReservationDTO(r: ReservationDoc, viewer: Actor, today: IsoDate): ReservationDTO {
  const checkIn = utcDateToIso(r.checkIn);
  const checkOut = utcDateToIso(r.checkOut);
  return {
    id: r._id.toString(),
    reference: r.reference,
    guest: { id: r.guest.toString(), name: r.guestName, email: r.guestEmail },
    roomType: { id: r.roomType.toString(), name: r.roomTypeName },
    checkIn,
    checkOut,
    nights: r.nights,
    guests: r.guests,
    roomCount: r.roomCount,
    pricePerNight: r.pricePerNight,
    totalAmount: r.totalAmount,
    currency: r.currency,
    status: r.status,
    statusHistory: r.statusHistory.map((h) => ({
      status: h.status,
      at: h.at.toISOString(),
      byUserId: h.byUserId ? h.byUserId.toString() : null,
      byRole: h.byRole,
      note: h.note ?? null,
    })),
    allowedActions: allowedActions(
      { status: r.status, guestId: r.guest.toString(), checkIn, checkOut },
      viewer,
      today,
    ),
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}
