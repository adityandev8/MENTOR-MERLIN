import { randomInt } from 'node:crypto';
import { Types, type FilterQuery } from 'mongoose';
import type {
  CreateReservationInput,
  FrontDeskView,
  IsoDate,
  Paginated,
  ReservationAction,
  ReservationDTO,
  ReservationSortField,
  ReservationStatus,
  SortOrder,
} from '@hotel/shared';
import { ReservationModel, type ReservationDoc } from '../models/reservation.model.js';
import { RoomTypeModel } from '../models/roomType.model.js';
import { UserModel } from '../models/user.model.js';
import { holdNights, releaseNights } from '../repositories/inventory.repository.js';
import { runInTransaction } from '../db/transaction.js';
import { calculateStayPrice } from '../domain/pricing.js';
import { eachNight, isoToUtcDate, maxIsoDate, utcDateToIso } from '../domain/dates.js';
import { validateStay } from '../domain/stay.js';
import { evaluateAction, isStaff, type Actor } from '../domain/lifecycle.js';
import { AppError } from '../utils/AppError.js';
import { buildMeta, escapeRegex, stableSort, toSkip, type PageParams } from '../utils/pagination.js';
import { env } from '../config/env.js';
import { hotelToday, stayRules } from './clock.js';
import { toReservationDTO } from './mappers.js';

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

const REF_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I ambiguity

export function generateReference(today: IsoDate): string {
  let suffix = '';
  for (let i = 0; i < 6; i++) suffix += REF_ALPHABET[randomInt(REF_ALPHABET.length)];
  return `HTL-${today.slice(2, 4)}${today.slice(5, 7)}-${suffix}`;
}

export interface CreateReservationResult {
  reservation: ReservationDTO;
  /** True when an earlier request with the same Idempotency-Key already created it. */
  replayed: boolean;
}

function isDuplicateKey(error: unknown, field: string): boolean {
  const e = error as { code?: number; keyPattern?: Record<string, unknown> };
  return e?.code === 11000 && !!e.keyPattern && field in e.keyPattern;
}

async function findReplay(
  actor: Actor,
  key: string,
  input: CreateReservationInput,
  today: IsoDate,
): Promise<CreateReservationResult | null> {
  const existing = await ReservationModel.findOne({ guest: actor.userId, idempotencyKey: key }).lean();
  if (!existing) return null;
  const samePayload =
    existing.roomType.toString() === input.roomTypeId &&
    utcDateToIso(existing.checkIn) === input.checkIn &&
    utcDateToIso(existing.checkOut) === input.checkOut &&
    existing.guests === input.guests &&
    existing.roomCount === input.rooms;
  if (!samePayload) {
    throw AppError.unprocessable('IDEMPOTENCY_KEY_REUSED', 'This Idempotency-Key was already used for a different booking');
  }
  return { reservation: toReservationDTO(existing, actor, today), replayed: true };
}

/**
 * Books a stay. The authoritative availability, capacity and price checks all happen
 * inside one transaction together with the inventory hold and the reservation insert,
 * so either all of it commits or none of it does.
 *
 * Concurrency: competing requests for the last room both try to increment the same
 * room_nights documents. MongoDB lets exactly one of them write; the other gets a write
 * conflict, is retried by runInTransaction, re-reads the ledger, finds no room and
 * returns 409 NO_AVAILABILITY.
 */
export async function createReservation(
  actor: Actor,
  input: CreateReservationInput,
  idempotencyKey: string | null,
): Promise<CreateReservationResult> {
  const today = hotelToday();
  if (idempotencyKey) {
    const replay = await findReplay(actor, idempotencyKey, input, today);
    if (replay) return replay;
  }

  const stay = validateStay(input.checkIn, input.checkOut, stayRules(today));
  if (input.guests < input.rooms) throw AppError.badRequest('Each room needs at least one guest');
  if (!Types.ObjectId.isValid(input.roomTypeId)) throw AppError.notFound('Room type not found');

  const guest = await UserModel.findById(actor.userId).lean();
  if (!guest) throw AppError.unauthenticated('Account no longer exists');

  const roomTypeId = new Types.ObjectId(input.roomTypeId);
  const nights = eachNight(stay.checkIn, stay.checkOut);
  const initialStatus: ReservationStatus = env.AUTO_CONFIRM_BOOKINGS ? 'CONFIRMED' : 'PENDING';

  const attempt = (): Promise<ReservationDoc> =>
    runInTransaction(
      async (session) => {
        // Read the room type inside the transaction: price, capacity and active flag come
        // from the database, never from the request.
        const rt = await RoomTypeModel.findById(roomTypeId, null, { session }).lean();
        if (!rt) throw AppError.notFound('Room type not found');
        if (!rt.isActive) throw AppError.conflict('ROOM_TYPE_INACTIVE', 'This room type is not currently bookable');
        if (input.guests > rt.capacity * input.rooms) {
          throw AppError.unprocessable(
            'CAPACITY_EXCEEDED',
            `This room type sleeps ${rt.capacity} per room; ${input.guests} guests cannot fit in ${input.rooms} room(s)`,
            { capacity: rt.capacity, rooms: input.rooms, guests: input.guests },
          );
        }

        await holdNights(session, { roomTypeId, nights, rooms: input.rooms, defaultTotal: rt.totalInventory });

        const now = new Date();
        const [created] = await ReservationModel.create(
          [
            {
              reference: generateReference(today),
              guest: guest._id,
              guestName: guest.name,
              guestEmail: guest.email,
              roomType: rt._id,
              roomTypeName: rt.name,
              checkIn: isoToUtcDate(stay.checkIn),
              checkOut: isoToUtcDate(stay.checkOut),
              nights: stay.nights,
              guests: input.guests,
              roomCount: input.rooms,
              pricePerNight: rt.pricePerNight,
              totalAmount: calculateStayPrice({ pricePerNight: rt.pricePerNight, nights: stay.nights, rooms: input.rooms }),
              currency: env.HOTEL_CURRENCY,
              status: initialStatus,
              statusHistory: [
                {
                  status: initialStatus,
                  at: now,
                  byUserId: guest._id,
                  byRole: actor.role,
                  note: env.AUTO_CONFIRM_BOOKINGS ? 'Auto-confirmed on booking' : null,
                },
              ],
              idempotencyKey,
            },
          ],
          { session },
        );
        if (!created) throw new Error('Reservation insert returned nothing');
        return created.toObject();
      },
      { label: 'createReservation' },
    );

  try {
    let doc: ReservationDoc;
    try {
      doc = await attempt();
    } catch (error) {
      // A 6-character random reference collision is astronomically rare; try once more.
      if (!isDuplicateKey(error, 'reference')) throw error;
      doc = await attempt();
    }
    return { reservation: toReservationDTO(doc, actor, today), replayed: false };
  } catch (error) {
    // Two concurrent requests with the same Idempotency-Key: the loser hits the unique
    // index (its transaction, including the inventory hold, is rolled back) and returns
    // the winner's reservation.
    if (idempotencyKey && isDuplicateKey(error, 'idempotencyKey')) {
      const replay = await findReplay(actor, idempotencyKey, input, today);
      if (replay) return replay;
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Read
// ---------------------------------------------------------------------------

export interface ReservationListParams extends PageParams {
  status?: ReservationStatus;
  q?: string;
  roomTypeId?: string;
  checkInFrom?: IsoDate;
  checkInTo?: IsoDate;
  stayDate?: IsoDate;
  sortBy: ReservationSortField;
  sortOrder: SortOrder;
}

function buildListFilter(p: ReservationListParams): FilterQuery<ReservationDoc> {
  const filter: FilterQuery<ReservationDoc> = {};
  if (p.status) filter.status = p.status;
  if (p.roomTypeId) filter.roomType = new Types.ObjectId(p.roomTypeId);
  if (p.checkInFrom || p.checkInTo) {
    filter.checkIn = {
      ...(p.checkInFrom ? { $gte: isoToUtcDate(p.checkInFrom) } : {}),
      ...(p.checkInTo ? { $lte: isoToUtcDate(p.checkInTo) } : {}),
    };
  }
  if (p.stayDate) {
    const night = isoToUtcDate(p.stayDate);
    filter.checkIn = { ...(filter.checkIn as object), $lte: night };
    filter.checkOut = { $gt: night };
  }
  if (p.q) {
    const term = p.q.trim();
    // Anchored prefix regexes can use the reference / guestEmail indexes.
    filter.$or = [
      { reference: { $regex: `^${escapeRegex(term.toUpperCase())}` } },
      { guestEmail: { $regex: `^${escapeRegex(term.toLowerCase())}` } },
    ];
  }
  return filter;
}

async function paginate(
  filter: FilterQuery<ReservationDoc>,
  sort: Record<string, 1 | -1>,
  page: PageParams,
  viewer: Actor,
): Promise<Paginated<ReservationDTO>> {
  const today = hotelToday();
  // The filter is applied in the database before skip/limit, and count uses the same filter.
  const [docs, total] = await Promise.all([
    ReservationModel.find(filter).sort(sort).skip(toSkip(page)).limit(page.limit).maxTimeMS(5_000).lean(),
    ReservationModel.countDocuments(filter).maxTimeMS(5_000),
  ]);
  return { items: docs.map((d) => toReservationDTO(d, viewer, today)), meta: buildMeta(page, total) };
}

/** Guests: only their own reservations. The owner filter comes from the token, never the query. */
export function listMyReservations(actor: Actor, p: ReservationListParams): Promise<Paginated<ReservationDTO>> {
  const filter = buildListFilter({ ...p, q: undefined, roomTypeId: undefined });
  filter.guest = new Types.ObjectId(actor.userId);
  return paginate(filter, stableSort(p.sortBy, p.sortOrder), p, actor);
}

export function listAllReservations(actor: Actor, p: ReservationListParams): Promise<Paginated<ReservationDTO>> {
  return paginate(buildListFilter(p), stableSort(p.sortBy, p.sortOrder), p, actor);
}

/** Front desk work queues. Eligibility is defined here, not in the UI. */
export function listFrontDesk(actor: Actor, view: FrontDeskView, page: PageParams): Promise<Paginated<ReservationDTO>> {
  const today = isoToUtcDate(hotelToday());
  let filter: FilterQuery<ReservationDoc>;
  switch (view) {
    case 'arrivals': // due today or late arrivals whose stay hasn't ended
      filter = { status: { $in: ['PENDING', 'CONFIRMED'] }, checkIn: { $lte: today }, checkOut: { $gt: today } };
      break;
    case 'in-house':
      filter = { status: 'CHECKED_IN' };
      break;
    case 'departures': // due today or overstaying
      filter = { status: 'CHECKED_IN', checkOut: { $lte: today } };
      break;
  }
  return paginate(filter, { checkIn: 1, _id: 1 }, page, actor);
}

/**
 * Guests get 404 (not 403) for someone else's reservation so they can't probe which
 * reservation ids exist.
 */
export async function getReservation(actor: Actor, id: string): Promise<ReservationDTO> {
  if (!Types.ObjectId.isValid(id)) throw AppError.notFound('Reservation not found');
  const doc = await ReservationModel.findById(id).lean();
  if (!doc || (!isStaff(actor.role) && doc.guest.toString() !== actor.userId)) {
    throw AppError.notFound('Reservation not found');
  }
  return toReservationDTO(doc, actor, hotelToday());
}

// ---------------------------------------------------------------------------
// Lifecycle
// ---------------------------------------------------------------------------

/**
 * Applies a lifecycle action. The status change and any inventory release happen in one
 * transaction, and the update is conditional on the status we validated against, so two
 * concurrent cancels can't both release inventory.
 */
export async function performAction(
  actor: Actor,
  id: string,
  action: ReservationAction,
  note: string | null,
): Promise<ReservationDTO> {
  if (!Types.ObjectId.isValid(id)) throw AppError.notFound('Reservation not found');
  const today = hotelToday();

  const doc = await runInTransaction(
    async (session) => {
      const current = await ReservationModel.findById(id, null, { session }).lean();
      if (!current || (!isStaff(actor.role) && current.guest.toString() !== actor.userId)) {
        throw AppError.notFound('Reservation not found');
      }
      const checkIn = utcDateToIso(current.checkIn);
      const checkOut = utcDateToIso(current.checkOut);
      const verdict = evaluateAction({ status: current.status, guestId: current.guest.toString(), checkIn, checkOut }, action, actor, today);
      if (!verdict.ok) {
        if (verdict.forbidden) throw AppError.forbidden(verdict.reason);
        throw AppError.conflict('INVALID_TRANSITION', verdict.reason, { status: current.status, action });
      }

      const set: Partial<ReservationDoc> = { status: verdict.to };
      if (action === 'CANCEL') {
        await releaseNights(session, { roomTypeId: current.roomType, nights: eachNight(checkIn, checkOut), rooms: current.roomCount });
      } else if (action === 'CHECK_OUT' && today < checkOut) {
        // Early departure: the remaining nights go back on sale.
        const from = maxIsoDate(today, checkIn);
        await releaseNights(session, { roomTypeId: current.roomType, nights: eachNight(from, checkOut), rooms: current.roomCount });
        set.releasedFrom = isoToUtcDate(from);
      }

      const updated = await ReservationModel.findOneAndUpdate(
        { _id: current._id, status: current.status },
        {
          $set: set,
          $push: {
            statusHistory: {
              status: verdict.to,
              at: new Date(),
              byUserId: new Types.ObjectId(actor.userId),
              byRole: actor.role,
              note,
            },
          },
        },
        { session, new: true },
      ).lean();
      if (!updated) {
        throw AppError.conflict('CONFLICT', 'The reservation was changed by someone else; refresh and try again');
      }
      return updated;
    },
    { label: `reservation:${action}` },
  );

  return toReservationDTO(doc, actor, today);
}
