import { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import { RESERVATION_STATUSES, ROLES, type ReservationStatus, type Role } from '@hotel/shared';

export interface StatusChangeDoc {
  status: ReservationStatus;
  at: Date;
  byUserId: Types.ObjectId | null;
  byRole: Role | 'SYSTEM';
  note: string | null;
}

export interface ReservationDoc {
  _id: Types.ObjectId;
  reference: string;
  guest: Types.ObjectId;
  /** Snapshots so staff search/listing needs no $lookup and history stays accurate. */
  guestName: string;
  guestEmail: string;
  roomType: Types.ObjectId;
  roomTypeName: string;
  checkIn: Date;
  checkOut: Date;
  nights: number;
  guests: number;
  roomCount: number;
  /** Price per room per night at the moment of booking (later price changes don't affect it). */
  pricePerNight: number;
  totalAmount: number;
  currency: string;
  status: ReservationStatus;
  statusHistory: StatusChangeDoc[];
  /** Client-supplied key making POST /reservations safe to retry. */
  idempotencyKey: string | null;
  /** Nights released back to inventory early (early check-out). */
  releasedFrom: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const statusChangeSchema = new Schema<StatusChangeDoc>(
  {
    status: { type: String, enum: RESERVATION_STATUSES, required: true },
    at: { type: Date, required: true },
    byUserId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    byRole: { type: String, enum: [...ROLES, 'SYSTEM'], required: true },
    note: { type: String, default: null, maxlength: 500 },
  },
  { _id: false },
);

const reservationSchema = new Schema<ReservationDoc>(
  {
    reference: { type: String, required: true },
    guest: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    guestName: { type: String, required: true },
    guestEmail: { type: String, required: true, lowercase: true },
    roomType: { type: Schema.Types.ObjectId, ref: 'RoomType', required: true },
    roomTypeName: { type: String, required: true },
    checkIn: { type: Date, required: true },
    checkOut: { type: Date, required: true },
    nights: { type: Number, required: true, min: 1 },
    guests: { type: Number, required: true, min: 1 },
    roomCount: { type: Number, required: true, min: 1 },
    pricePerNight: { type: Number, required: true, min: 0 },
    totalAmount: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true },
    status: { type: String, enum: RESERVATION_STATUSES, required: true },
    statusHistory: { type: [statusChangeSchema], default: [] },
    idempotencyKey: { type: String, default: null },
    releasedFrom: { type: Date, default: null },
  },
  { timestamps: true },
);

// Human-facing lookup ("HTL-…") and uniqueness of references.
reservationSchema.index({ reference: 1 }, { unique: true });
// "My reservations": equality on guest, then newest first; _id makes the sort stable.
reservationSchema.index({ guest: 1, createdAt: -1, _id: -1 });
// Safe retries: one reservation per (guest, idempotency key). Partial so null keys are not indexed.
reservationSchema.index(
  { guest: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } },
);
// Staff list default sort (newest first) and status-filtered lists.
reservationSchema.index({ createdAt: -1, _id: -1 });
reservationSchema.index({ status: 1, createdAt: -1, _id: -1 });
// Arrivals / date filters (equality on status, range on checkIn) and departures.
reservationSchema.index({ status: 1, checkIn: 1 });
reservationSchema.index({ status: 1, checkOut: 1 });
reservationSchema.index({ checkIn: 1, _id: 1 });
// Staff search by guest email prefix.
reservationSchema.index({ guestEmail: 1 });

export type ReservationDocument = HydratedDocument<ReservationDoc>;
export const ReservationModel = model<ReservationDoc>('Reservation', reservationSchema);
