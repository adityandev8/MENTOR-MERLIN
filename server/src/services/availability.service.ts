import { Types } from 'mongoose';
import type { AvailabilityItem, Paginated, Quote, StayQuery } from '@hotel/shared';
import { RoomTypeModel } from '../models/roomType.model.js';
import { availableRoomsByType } from '../repositories/inventory.repository.js';
import { calculateStayPrice } from '../domain/pricing.js';
import { eachNight } from '../domain/dates.js';
import { validateStay } from '../domain/stay.js';
import { AppError } from '../utils/AppError.js';
import { buildMeta, toSkip, type PageParams } from '../utils/pagination.js';
import { env } from '../config/env.js';
import { stayRules } from './clock.js';
import { toRoomTypeDTO } from './mappers.js';

/** Smallest per-room capacity that can fit `guests` across `rooms` rooms. */
export function requiredCapacityPerRoom(guests: number, rooms: number): number {
  return Math.ceil(guests / rooms);
}

/**
 * Availability search. Room types that can't fit the party are filtered out in the
 * query (before pagination). Room types that fit but are sold out stay in the list with
 * isAvailable=false so guests can see why they can't book them.
 */
export async function searchAvailability(q: Required<StayQuery>, page: PageParams): Promise<Paginated<AvailabilityItem>> {
  const stay = validateStay(q.checkIn, q.checkOut, stayRules());
  if (q.guests < q.rooms) throw AppError.badRequest('Each room needs at least one guest');

  const filter = { isActive: true, capacity: { $gte: requiredCapacityPerRoom(q.guests, q.rooms) } };
  const [docs, total] = await Promise.all([
    RoomTypeModel.find(filter).sort({ pricePerNight: 1, _id: 1 }).skip(toSkip(page)).limit(page.limit).maxTimeMS(5_000).lean(),
    RoomTypeModel.countDocuments(filter).maxTimeMS(5_000),
  ]);

  const nights = eachNight(stay.checkIn, stay.checkOut);
  const available = await availableRoomsByType(
    docs.map((d) => ({ id: d._id, totalInventory: d.totalInventory })),
    nights,
  );

  const items: AvailabilityItem[] = docs.map((d) => {
    const availableRooms = available.get(d._id.toString()) ?? 0;
    return {
      roomType: toRoomTypeDTO(d),
      availableRooms,
      isAvailable: availableRooms >= q.rooms,
      nights: stay.nights,
      roomsRequested: q.rooms,
      totalPrice: calculateStayPrice({ pricePerNight: d.pricePerNight, nights: stay.nights, rooms: q.rooms }),
    };
  });
  return { items, meta: buildMeta(page, total) };
}

/** Server-side price + availability for a specific room type, shown on the booking page. */
export async function getQuote(roomTypeId: string, q: Required<StayQuery>): Promise<Quote> {
  const stay = validateStay(q.checkIn, q.checkOut, stayRules());
  if (!Types.ObjectId.isValid(roomTypeId)) throw AppError.notFound('Room type not found');
  const rt = await RoomTypeModel.findById(roomTypeId).lean();
  if (!rt || !rt.isActive) throw AppError.notFound('Room type not found');

  const available = await availableRoomsByType([{ id: rt._id, totalInventory: rt.totalInventory }], eachNight(stay.checkIn, stay.checkOut));
  const availableRooms = available.get(rt._id.toString()) ?? 0;

  let unavailableReason: string | null = null;
  if (q.guests < q.rooms) unavailableReason = 'Each room needs at least one guest';
  else if (q.guests > rt.capacity * q.rooms) {
    unavailableReason = `This room type sleeps ${rt.capacity} per room; ${q.guests} guests need at least ${requiredRooms(q.guests, rt.capacity)} rooms`;
  } else if (availableRooms < q.rooms) {
    unavailableReason = availableRooms === 0 ? 'Sold out for these dates' : `Only ${availableRooms} room(s) left for these dates`;
  }

  return {
    roomTypeId: rt._id.toString(),
    checkIn: stay.checkIn,
    checkOut: stay.checkOut,
    nights: stay.nights,
    guests: q.guests,
    rooms: q.rooms,
    pricePerNight: rt.pricePerNight,
    totalPrice: calculateStayPrice({ pricePerNight: rt.pricePerNight, nights: stay.nights, rooms: q.rooms }),
    currency: env.HOTEL_CURRENCY,
    availableRooms,
    isAvailable: unavailableReason === null,
    unavailableReason,
  };
}

function requiredRooms(guests: number, capacity: number): number {
  return Math.ceil(guests / capacity);
}
