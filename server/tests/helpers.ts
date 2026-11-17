import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import request from 'supertest';
import { afterAll, afterEach, beforeAll } from 'vitest';
import type { Express } from 'express';
import type { ApiSuccess, RoomTypeDTO, Role } from '@hotel/shared';
import { createApp } from '../src/app.js';
import { UserModel } from '../src/models/user.model.js';
import { RoomTypeModel } from '../src/models/roomType.model.js';
import { RoomNightModel } from '../src/models/roomNight.model.js';
import { ReservationModel } from '../src/models/reservation.model.js';
import { addDays } from '../src/domain/dates.js';
import { hotelToday } from '../src/services/clock.js';

/** Connects this test file to its own fresh database on the in-memory replica set. */
export function useTestDatabase(): { app: () => Express } {
  let app: Express | undefined;
  beforeAll(async () => {
    const uri = process.env.TEST_MONGO_URI;
    if (!uri) throw new Error('TEST_MONGO_URI missing; globalSetup did not run');
    await mongoose.connect(uri, { dbName: `hotel_test_${randomUUID().slice(0, 8)}` });
    await UserModel.syncIndexes();
    await RoomTypeModel.syncIndexes();
    await RoomNightModel.syncIndexes();
    await ReservationModel.syncIndexes();
    app = createApp();
  });
  afterEach(async () => {
    await Promise.all([UserModel.deleteMany({}), RoomTypeModel.deleteMany({}), RoomNightModel.deleteMany({}), ReservationModel.deleteMany({})]);
  });
  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });
  return {
    app: () => {
      if (!app) throw new Error('app not ready');
      return app;
    },
  };
}

export const today = (): string => hotelToday();
export const inDays = (n: number): string => addDays(hotelToday(), n);

let userSeq = 0;
const PASSWORD = 'Password123';
const passwordHash = bcrypt.hashSync(PASSWORD, 4);

export interface TestUser {
  id: string;
  token: string;
  email: string;
}

export async function createUser(app: Express, role: Role = 'GUEST'): Promise<TestUser> {
  userSeq += 1;
  const email = `${role.toLowerCase()}${userSeq}-${randomUUID().slice(0, 6)}@test.local`;
  const user = await UserModel.create({ name: `${role} ${userSeq}`, email, passwordHash, role });
  const res = await request(app).post('/api/auth/login').send({ email, password: PASSWORD }).expect(200);
  return { id: user._id.toString(), token: (res.body as ApiSuccess<{ token: string }>).data.token, email };
}

export async function createRoomType(overrides: Partial<{ name: string; capacity: number; pricePerNight: number; totalInventory: number; isActive: boolean }> = {}): Promise<RoomTypeDTO> {
  const doc = await RoomTypeModel.create({
    name: overrides.name ?? `Room ${randomUUID().slice(0, 6)}`,
    description: 'A comfortable room for testing.',
    capacity: overrides.capacity ?? 2,
    facilities: ['Wi-Fi'],
    pricePerNight: overrides.pricePerNight ?? 4000,
    totalInventory: overrides.totalInventory ?? 1,
    isActive: overrides.isActive ?? true,
  });
  return { id: doc._id.toString() } as RoomTypeDTO;
}

export function auth(user: TestUser): [string, string] {
  return ['Authorization', `Bearer ${user.token}`];
}

export function book(app: Express, user: TestUser, body: Record<string, unknown>, idempotencyKey?: string) {
  const req = request(app).post('/api/reservations').set(...auth(user));
  if (idempotencyKey) req.set('Idempotency-Key', idempotencyKey);
  return req.send(body);
}

export async function bookedOn(roomTypeId: string, date: string): Promise<number> {
  const night = await RoomNightModel.findById(`${roomTypeId}:${date}`).lean();
  return night?.booked ?? 0;
}
