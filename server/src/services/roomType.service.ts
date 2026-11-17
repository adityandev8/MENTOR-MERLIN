import { Types, type FilterQuery } from 'mongoose';
import type { Paginated, RoomTypeDTO, RoomTypeInput, RoomTypeSortField, RoomTypeUpdateInput, SortOrder } from '@hotel/shared';
import { RoomTypeModel, type RoomTypeDoc } from '../models/roomType.model.js';
import { AppError } from '../utils/AppError.js';
import { buildMeta, escapeRegex, stableSort, toSkip, type PageParams } from '../utils/pagination.js';
import { runInTransaction } from '../db/transaction.js';
import { setInventory } from '../repositories/inventory.repository.js';
import { addDays, eachNight } from '../domain/dates.js';
import { env } from '../config/env.js';
import { hotelToday } from './clock.js';
import { toRoomTypeDTO } from './mappers.js';

export interface RoomTypeListParams extends PageParams {
  includeInactive: boolean;
  q?: string;
  sortBy: RoomTypeSortField;
  sortOrder: SortOrder;
}

export async function listRoomTypes(p: RoomTypeListParams): Promise<Paginated<RoomTypeDTO>> {
  const filter: FilterQuery<RoomTypeDoc> = {};
  if (!p.includeInactive) filter.isActive = true;
  if (p.q) filter.name = { $regex: escapeRegex(p.q), $options: 'i' };

  // Filter → count and page run on the same filter, in the database.
  const [items, total] = await Promise.all([
    RoomTypeModel.find(filter).sort(stableSort(p.sortBy, p.sortOrder)).skip(toSkip(p)).limit(p.limit).maxTimeMS(5_000).lean(),
    RoomTypeModel.countDocuments(filter).maxTimeMS(5_000),
  ]);
  return { items: items.map(toRoomTypeDTO), meta: buildMeta(p, total) };
}

export async function getRoomType(id: string, { includeInactive }: { includeInactive: boolean }): Promise<RoomTypeDTO> {
  if (!Types.ObjectId.isValid(id)) throw AppError.notFound('Room type not found');
  const doc = await RoomTypeModel.findById(id).lean();
  if (!doc || (!doc.isActive && !includeInactive)) throw AppError.notFound('Room type not found');
  return toRoomTypeDTO(doc);
}

function duplicateNameGuard(error: unknown): never {
  if ((error as { code?: number }).code === 11000) {
    throw AppError.conflict('CONFLICT', 'A room type with this name already exists');
  }
  throw error;
}

export async function createRoomType(input: RoomTypeInput): Promise<RoomTypeDTO> {
  try {
    const doc = await RoomTypeModel.create({ ...input, imageUrl: input.imageUrl ?? null });
    return toRoomTypeDTO(doc.toObject());
  } catch (error) {
    duplicateNameGuard(error);
  }
}

/**
 * Updates a room type. Price changes only affect *new* bookings because each reservation
 * stores its own price snapshot. Inventory changes run in a transaction together with the
 * ledger update so they can't race with bookings (see setInventory).
 */
export async function updateRoomType(id: string, input: RoomTypeUpdateInput): Promise<RoomTypeDTO> {
  if (!Types.ObjectId.isValid(id)) throw AppError.notFound('Room type not found');
  const objectId = new Types.ObjectId(id);

  try {
    return await runInTransaction(
      async (session) => {
        const current = await RoomTypeModel.findById(objectId, null, { session }).lean();
        if (!current) throw AppError.notFound('Room type not found');

        if (input.totalInventory !== undefined && input.totalInventory !== current.totalInventory) {
          const today = hotelToday();
          // +2 days covers requests computing "today" either side of midnight.
          const until = addDays(today, env.BOOKING_WINDOW_DAYS + 2);
          await setInventory(session, {
            roomTypeId: objectId,
            newTotal: input.totalInventory,
            fromDate: today,
            toDate: until,
            nights: eachNight(today, until),
          });
        }

        const updated = await RoomTypeModel.findByIdAndUpdate(objectId, { $set: input }, {
          session,
          new: true,
          runValidators: true,
        }).lean();
        if (!updated) throw AppError.notFound('Room type not found');
        return toRoomTypeDTO(updated);
      },
      { label: 'updateRoomType' },
    );
  } catch (error) {
    duplicateNameGuard(error);
  }
}
