import { z } from 'zod';
import { ROOM_TYPE_SORT_FIELDS } from '@hotel/shared';
import { optionalQuery, pageQuery, queryBool, sortOrder } from './common.js';

const roomTypeFields = {
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().min(10, 'Description must be at least 10 characters').max(2000),
  capacity: z.number().int().min(1).max(20),
  facilities: z.array(z.string().trim().min(1).max(50)).max(30).transform((list) => [...new Set(list)]),
  pricePerNight: z.number().int('Price must be a whole amount').min(0).max(10_000_000),
  totalInventory: z.number().int().min(0).max(1000),
  isActive: z.boolean(),
  imageUrl: z.url({ protocol: /^https?$/ }).max(2048).nullable().optional(),
};

export const createRoomTypeSchema = z.object(roomTypeFields).strict();

export const updateRoomTypeSchema = z
  .object(roomTypeFields)
  .partial()
  .strict()
  .refine((v) => Object.keys(v).length > 0, 'Provide at least one field to update');

export const listRoomTypesQuery = z.object({
  ...pageQuery,
  includeInactive: queryBool,
  q: optionalQuery(z.string().trim().max(80)),
  sortBy: optionalQuery(z.enum(ROOM_TYPE_SORT_FIELDS)).transform((v) => v ?? 'pricePerNight'),
  sortOrder: optionalQuery(sortOrder).transform((v) => v ?? 'asc'),
});
