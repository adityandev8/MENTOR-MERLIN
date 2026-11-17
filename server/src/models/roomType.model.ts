import { Schema, model, type HydratedDocument, type Types } from 'mongoose';

export interface RoomTypeDoc {
  _id: Types.ObjectId;
  name: string;
  description: string;
  capacity: number;
  facilities: string[];
  pricePerNight: number;
  totalInventory: number;
  isActive: boolean;
  imageUrl: string | null;
  createdAt: Date;
  updatedAt: Date;
}

const integer = { validator: Number.isInteger, message: '{PATH} must be an integer' };

const roomTypeSchema = new Schema<RoomTypeDoc>(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    description: { type: String, required: true, trim: true, maxlength: 2000 },
    capacity: { type: Number, required: true, min: 1, max: 20, validate: integer },
    facilities: { type: [String], default: [] },
    pricePerNight: { type: Number, required: true, min: 0, validate: integer },
    totalInventory: { type: Number, required: true, min: 0, max: 1000, validate: integer },
    isActive: { type: Boolean, required: true, default: true },
    imageUrl: { type: String, default: null },
  },
  { timestamps: true },
);

roomTypeSchema.index({ name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });
// Guest catalogue: active room types sorted by price (with _id tie-break for stable pagination).
roomTypeSchema.index({ isActive: 1, pricePerNight: 1, _id: 1 });

export type RoomTypeDocument = HydratedDocument<RoomTypeDoc>;
export const RoomTypeModel = model<RoomTypeDoc>('RoomType', roomTypeSchema);
