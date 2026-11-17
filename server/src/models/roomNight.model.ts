import { Schema, model, type Types } from 'mongoose';
import type { IsoDate } from '@hotel/shared';

/**
 * The inventory ledger: one document per (room type, night).
 *
 * `_id` is deterministic — `<roomTypeId>:<YYYY-MM-DD>` — so:
 *  - two requests creating the same night collide on the primary key, which is
 *    always unique and never depends on a secondary index having been built;
 *  - a stay's nights are fetched with an exact `$in` on `_id` (or a range,
 *    because ISO dates sort lexicographically).
 *
 * Invariant enforced by every write: 0 <= booked <= total.
 */
export interface RoomNightDoc {
  _id: string;
  roomType: Types.ObjectId;
  date: Date;
  /** Sellable rooms for this night (copied from RoomType.totalInventory). */
  total: number;
  /** Rooms held by PENDING / CONFIRMED / CHECKED_IN reservations. */
  booked: number;
}

const roomNightSchema = new Schema<RoomNightDoc>(
  {
    _id: { type: String, required: true },
    roomType: { type: Schema.Types.ObjectId, ref: 'RoomType', required: true },
    date: { type: Date, required: true },
    total: { type: Number, required: true, min: 0 },
    booked: { type: Number, required: true, min: 0, default: 0 },
  },
  { timestamps: false, versionKey: false },
);

export function roomNightId(roomTypeId: string | Types.ObjectId, date: IsoDate): string {
  return `${roomTypeId.toString()}:${date}`;
}

export const RoomNightModel = model<RoomNightDoc>('RoomNight', roomNightSchema, 'room_nights');
