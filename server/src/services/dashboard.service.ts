import type { DashboardSummary } from '@hotel/shared';
import { ReservationModel } from '../models/reservation.model.js';
import { RoomTypeModel } from '../models/roomType.model.js';
import { isoToUtcDate } from '../domain/dates.js';
import { hotelToday } from './clock.js';

/** Today's operational counts. Each query is index-backed (see reservation.model.ts). */
export async function getDashboardSummary(): Promise<DashboardSummary> {
  const date = hotelToday();
  const today = isoToUtcDate(date);

  const [arrivalsToday, arrivalsPendingCheckIn, departuresToday, inHouse, pending, rooms] = await Promise.all([
    ReservationModel.countDocuments({ status: { $in: ['PENDING', 'CONFIRMED', 'CHECKED_IN'] }, checkIn: today }),
    ReservationModel.countDocuments({ status: { $in: ['PENDING', 'CONFIRMED'] }, checkIn: { $lte: today }, checkOut: { $gt: today } }),
    ReservationModel.countDocuments({ status: 'CHECKED_IN', checkOut: { $lte: today } }),
    ReservationModel.aggregate<{ reservations: number; rooms: number }>([
      { $match: { status: 'CHECKED_IN' } },
      { $group: { _id: null, reservations: { $sum: 1 }, rooms: { $sum: '$roomCount' } } },
    ]),
    ReservationModel.countDocuments({ status: 'PENDING' }),
    RoomTypeModel.aggregate<{ totalRooms: number; activeRoomTypes: number }>([
      { $match: { isActive: true } },
      { $group: { _id: null, totalRooms: { $sum: '$totalInventory' }, activeRoomTypes: { $sum: 1 } } },
    ]),
  ]);

  const occupiedRooms = inHouse[0]?.rooms ?? 0;
  const totalRooms = rooms[0]?.totalRooms ?? 0;
  return {
    date,
    arrivalsToday,
    arrivalsPendingCheckIn,
    departuresToday,
    inHouseReservations: inHouse[0]?.reservations ?? 0,
    occupiedRooms,
    totalRooms,
    occupancyRate: totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 1000) / 10 : 0,
    pendingReservations: pending,
    activeRoomTypes: rooms[0]?.activeRoomTypes ?? 0,
  };
}
