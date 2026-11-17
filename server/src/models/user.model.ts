import { Schema, model, type HydratedDocument, type Types } from 'mongoose';
import { ROLES, type Role } from '@hotel/shared';

export interface UserDoc {
  _id: Types.ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<UserDoc>(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    email: { type: String, required: true, trim: true, lowercase: true, maxlength: 254 },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, required: true, default: 'GUEST' },
  },
  { timestamps: true },
);

// Login lookup + uniqueness. Emails are lower-cased before save so the index is effectively case-insensitive.
userSchema.index({ email: 1 }, { unique: true });

export type UserDocument = HydratedDocument<UserDoc>;
export const UserModel = model<UserDoc>('User', userSchema);
