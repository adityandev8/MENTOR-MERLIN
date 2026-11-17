import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { Types } from 'mongoose';
import { ROLES, type AuthResult, type LoginInput, type PublicUser, type RegisterInput, type Role } from '@hotel/shared';
import { env } from '../config/env.js';
import { UserModel } from '../models/user.model.js';
import { AppError } from '../utils/AppError.js';
import { toPublicUser } from './mappers.js';
import type { Actor } from '../domain/lifecycle.js';

const BCRYPT_ROUNDS = 10;
// Compared against when the email doesn't exist, so login timing doesn't reveal which emails are registered.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', BCRYPT_ROUNDS);

interface TokenClaims {
  sub: string;
  role: Role;
}

function signToken(user: PublicUser): string {
  const claims: TokenClaims = { sub: user.id, role: user.role };
  return jwt.sign(claims, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'] });
}

export function verifyToken(token: string): Actor {
  let payload: string | jwt.JwtPayload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
  } catch {
    throw AppError.unauthenticated('Session is invalid or has expired');
  }
  if (typeof payload === 'string' || typeof payload.sub !== 'string' || !Types.ObjectId.isValid(payload.sub)) {
    throw AppError.unauthenticated('Session is invalid');
  }
  const role = (payload as { role?: unknown }).role;
  if (typeof role !== 'string' || !(ROLES as readonly string[]).includes(role)) {
    throw AppError.unauthenticated('Session is invalid');
  }
  return { userId: payload.sub, role: role as Role };
}

/** Public sign-up always creates a GUEST. Staff accounts are provisioned by the seed script / an admin. */
export async function register(input: RegisterInput): Promise<AuthResult> {
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS);
  try {
    const doc = await UserModel.create({ name: input.name, email: input.email, passwordHash, role: 'GUEST' });
    const user = toPublicUser(doc);
    return { token: signToken(user), expiresIn: env.JWT_EXPIRES_IN, user };
  } catch (error) {
    if ((error as { code?: number }).code === 11000) {
      throw AppError.conflict('EMAIL_TAKEN', 'An account with this email already exists');
    }
    throw error;
  }
}

export async function login(input: LoginInput): Promise<AuthResult> {
  const doc = await UserModel.findOne({ email: input.email.toLowerCase() }).select('+passwordHash');
  const ok = await bcrypt.compare(input.password, doc?.passwordHash ?? DUMMY_HASH);
  if (!doc || !ok) throw new AppError(401, 'INVALID_CREDENTIALS', 'Email or password is incorrect');
  const user = toPublicUser(doc);
  return { token: signToken(user), expiresIn: env.JWT_EXPIRES_IN, user };
}

export async function getCurrentUser(userId: string): Promise<PublicUser> {
  const doc = await UserModel.findById(userId);
  if (!doc) throw AppError.unauthenticated('Account no longer exists');
  return toPublicUser(doc);
}
