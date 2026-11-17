import type { ClientSession, Types } from 'mongoose';
import type { IsoDate } from '@hotel/shared';
import { RoomNightModel, roomNightId, type RoomNightDoc } from '../models/roomNight.model.js';
import { isoToUtcDate, utcDateToIso } from '../domain/dates.js';
import { AppError } from '../utils/AppError.js';

/**
 * Data access for the per-night inventory ledger (room_nights).
 *
 * Every mutating function here must be called inside a transaction (see
 * db/transaction.ts). The conditional updates are what make overbooking
 * impossible; the transaction is what makes a multi-night hold all-or-nothing.
 */

interface HoldParams {
  roomTypeId: Types.ObjectId;
  nights: IsoDate[];
  rooms: number;
  /** Used only when a night document does not exist yet (lazy creation). */
  defaultTotal: number;
}

export async function holdNights(session: ClientSession, p: HoldParams): Promise<void> {
  const ids = p.nights.map((d) => roomNightId(p.roomTypeId, d));

  // 1) Make sure a ledger row exists for every night. $setOnInsert never touches existing rows.
  //    If two transactions create the same night concurrently, one gets a write conflict /
  //    duplicate _id and is retried by runInTransaction.
  await RoomNightModel.bulkWrite(
    p.nights.map((date, i) => ({
      updateOne: {
        filter: { _id: ids[i] },
        update: {
          $setOnInsert: { roomType: p.roomTypeId, date: isoToUtcDate(date), total: p.defaultTotal, booked: 0 },
        },
        upsert: true,
      },
    })),
    { session, ordered: false },
  );

  // 2) Atomic conditional increment: only nights that still have `rooms` free are incremented.
  //    The condition is evaluated against the document being written, and MongoDB raises a
  //    WriteConflict if another transaction modified that same night after our snapshot, so two
  //    requests can never both take the last room.
  const result = await RoomNightModel.updateMany(
    { _id: { $in: ids }, $expr: { $lte: [{ $add: ['$booked', p.rooms] }, '$total'] } },
    { $inc: { booked: p.rooms } },
    { session },
  );

  if (result.modifiedCount !== ids.length) {
    // Some nights were short. The caller's transaction is aborted, which rolls back the
    // increments that did succeed. The report is read outside the transaction so it reflects
    // committed state, not our own partial increments.
    throw AppError.conflict('NO_AVAILABILITY', 'Not enough rooms are available for every night of this stay', {
      unavailableNights: await shortNights(ids, p.rooms),
    });
  }
}

async function shortNights(ids: string[], rooms: number): Promise<{ date: IsoDate; available: number }[]> {
  const nights = await RoomNightModel.find(
    { _id: { $in: ids }, $expr: { $gt: [{ $add: ['$booked', rooms] }, '$total'] } },
    { date: 1, total: 1, booked: 1 },
  ).lean();
  return nights
    .map((n) => ({ date: utcDateToIso(n.date), available: Math.max(0, n.total - n.booked) }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

interface ReleaseParams {
  roomTypeId: Types.ObjectId;
  nights: IsoDate[];
  rooms: number;
}

export async function releaseNights(session: ClientSession, p: ReleaseParams): Promise<void> {
  if (p.nights.length === 0) return;
  const ids = p.nights.map((d) => roomNightId(p.roomTypeId, d));
  // `booked >= rooms` guard means the counter can never go negative.
  const result = await RoomNightModel.updateMany(
    { _id: { $in: ids }, booked: { $gte: p.rooms } },
    { $inc: { booked: -p.rooms } },
    { session },
  );
  if (result.modifiedCount !== ids.length) {
    // Should be impossible if every hold/release goes through this module. Abort loudly
    // rather than silently corrupting the ledger.
    throw new Error(`Inventory ledger inconsistency releasing ${ids.length} nights (released ${result.modifiedCount})`);
  }
}

interface SetInventoryParams {
  roomTypeId: Types.ObjectId;
  newTotal: number;
  /** First night affected (today, hotel time). Past nights are history and left alone. */
  fromDate: IsoDate;
  /** Nights in [fromDate, toDate) are materialised so concurrent lazy creation conflicts with us. */
  toDate: IsoDate;
  nights: IsoDate[];
}

/**
 * Changes sellable inventory for all current and future nights of a room type, rejecting
 * a reduction below what is already booked on any night.
 *
 * Every night in the booking window is upserted (not just existing ones). A booking that
 * is concurrently creating one of those nights therefore writes the same `_id`, so the two
 * transactions conflict and one retries; without this, a booking could lazily create a
 * night with the old total after we committed (a write-skew anomaly).
 */
export async function setInventory(session: ClientSession, p: SetInventoryParams): Promise<void> {
  const prefix = p.roomTypeId.toString();
  await RoomNightModel.bulkWrite(
    p.nights.map((date) => ({
      updateOne: {
        filter: { _id: roomNightId(p.roomTypeId, date) },
        update: {
          $set: { total: p.newTotal },
          $setOnInsert: { roomType: p.roomTypeId, date: isoToUtcDate(date), booked: 0 },
        },
        upsert: true,
      },
    })),
    { session, ordered: false },
  );
  // Rows beyond the window (e.g. the window was shortened by config) also follow the new total.
  await RoomNightModel.updateMany(
    { _id: { $gte: `${prefix}:${p.toDate}`, $lt: `${prefix}:~` } },
    { $set: { total: p.newTotal } },
    { session },
  );

  const overbooked = await RoomNightModel.findOne(
    { _id: { $gte: `${prefix}:${p.fromDate}`, $lt: `${prefix}:~` }, $expr: { $gt: ['$booked', '$total'] } },
    { date: 1, booked: 1 },
    { session, sort: { _id: 1 } },
  ).lean();
  if (overbooked) {
    throw AppError.conflict(
      'INVENTORY_BELOW_BOOKED',
      `Inventory cannot be reduced to ${p.newTotal}: ${overbooked.booked} rooms are already booked on ${utcDateToIso(overbooked.date)}`,
      { date: utcDateToIso(overbooked.date), booked: overbooked.booked },
    );
  }
}

/**
 * Rooms free on *every* night of the stay, per room type: min over nights of (total - booked).
 * Nights with no ledger row are fully available (defaultTotal). This is a plain read for
 * display; the authoritative check happens again inside the booking transaction.
 */
export async function availableRoomsByType(
  roomTypes: { id: Types.ObjectId; totalInventory: number }[],
  nights: IsoDate[],
): Promise<Map<string, number>> {
  const ids = roomTypes.flatMap((rt) => nights.map((d) => roomNightId(rt.id, d)));
  const docs = ids.length
    ? await RoomNightModel.find({ _id: { $in: ids } }, { total: 1, booked: 1 }).lean<Pick<RoomNightDoc, '_id' | 'total' | 'booked'>[]>()
    : [];
  const byId = new Map(docs.map((d) => [d._id, d]));

  const result = new Map<string, number>();
  for (const rt of roomTypes) {
    let min = rt.totalInventory;
    for (const date of nights) {
      const doc = byId.get(roomNightId(rt.id, date));
      const free = doc ? doc.total - doc.booked : rt.totalInventory;
      if (free < min) min = free;
    }
    result.set(rt.id.toString(), Math.max(0, min));
  }
  return result;
}
