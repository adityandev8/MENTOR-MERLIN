/**
 * Development seed: staff + guest accounts, room types, and a few reservations that make the
 * dashboard and front desk interesting today. Resets the database; refuses to run in production.
 *
 * Reservations are created through the real service so the inventory ledger stays consistent.
 */
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { connectDatabase, disconnectDatabase } from '../src/db/connection.js';
import { UserModel } from '../src/models/user.model.js';
import { RoomTypeModel } from '../src/models/roomType.model.js';
import { RoomNightModel } from '../src/models/roomNight.model.js';
import { ReservationModel } from '../src/models/reservation.model.js';
import { createReservation, performAction } from '../src/services/reservation.service.js';
import { hotelToday } from '../src/services/clock.js';
import { addDays } from '../src/domain/dates.js';
import type { Actor } from '../src/domain/lifecycle.js';
import type { Role } from '@hotel/shared';

if (env.NODE_ENV === 'production') {
  console.error('Refusing to seed a production database.');
  process.exit(1);
}

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.startsWith('<')) {
    console.error(`Set ${name} in server/.env before seeding (see .env.example).`);
    process.exit(1);
  }
  return value;
}

const accounts: { name: string; email: string; password: string; role: Role }[] = [
  { name: 'Hotel Admin', email: required('SEED_ADMIN_EMAIL'), password: required('SEED_ADMIN_PASSWORD'), role: 'ADMIN' },
  { name: 'Front Desk', email: required('SEED_STAFF_EMAIL'), password: required('SEED_STAFF_PASSWORD'), role: 'STAFF' },
  { name: 'Demo Guest', email: required('SEED_GUEST_EMAIL'), password: required('SEED_GUEST_PASSWORD'), role: 'GUEST' },
];

const roomTypes = [
  {
    name: 'Standard Queen',
    description: 'A calm, compact room with a queen bed, work desk and rain shower. Ideal for solo travellers and couples.',
    capacity: 2,
    facilities: ['Wi-Fi', 'Air conditioning', 'Rain shower', 'Work desk', 'Smart TV'],
    pricePerNight: 6500,
    totalInventory: 12,
  },
  {
    name: 'Deluxe King',
    description: 'Spacious king room with a seating nook, city views and a deep soaking tub.',
    capacity: 2,
    facilities: ['Wi-Fi', 'Air conditioning', 'Bathtub', 'City view', 'Minibar', 'Nespresso machine'],
    pricePerNight: 7200,
    totalInventory: 8,
  },
  {
    name: 'Family Suite',
    description: 'Two connected rooms with a king bed and two singles, plus a lounge area. Sleeps a family of four.',
    capacity: 4,
    facilities: ['Wi-Fi', 'Air conditioning', 'Sofa bed', 'Kitchenette', 'Two bathrooms'],
    pricePerNight: 8200,
    totalInventory: 4,
  },
  {
    name: 'Backwater Villa',
    description: 'A private villa on the water with a plunge pool and open-air deck. Only two on the property.',
    capacity: 3,
    facilities: ['Wi-Fi', 'Private pool', 'Deck', 'Butler service', 'Outdoor shower'],
    pricePerNight: 9000,
    totalInventory: 2,
  },
  {
    name: 'Garden Twin (renovating)',
    description: 'Two single beds facing the garden. Temporarily closed for renovation.',
    capacity: 2,
    facilities: ['Wi-Fi', 'Garden view'],
    pricePerNight: 6000,
    totalInventory: 6,
    isActive: false,
  },
];

await connectDatabase();
await Promise.all([UserModel, RoomTypeModel, RoomNightModel, ReservationModel].map((m) => m.collection.deleteMany({})));
await Promise.all([UserModel.syncIndexes(), RoomTypeModel.syncIndexes(), RoomNightModel.syncIndexes(), ReservationModel.syncIndexes()]);

const users = await UserModel.create(
  await Promise.all(accounts.map(async (a) => ({ name: a.name, email: a.email, role: a.role, passwordHash: await bcrypt.hash(a.password, 10) }))),
);
const rts = await RoomTypeModel.create(roomTypes.map((r) => ({ isActive: true, imageUrl: null, ...r })));

const staffUser = users.find((u) => u.role === 'STAFF')!;
const guestUser = users.find((u) => u.role === 'GUEST')!;
const staff: Actor = { userId: staffUser._id.toString(), role: 'STAFF' };
const guest: Actor = { userId: guestUser._id.toString(), role: 'GUEST' };
const today = hotelToday();
const [standard, deluxe, family, villa] = rts.map((r) => r._id.toString());

const plan: { roomTypeId: string; from: number; to: number; guests: number; rooms: number; actions: ('CONFIRM' | 'CHECK_IN' | 'CANCEL')[] }[] = [
  { roomTypeId: standard!, from: 0, to: 2, guests: 2, rooms: 1, actions: ['CONFIRM'] }, // arrival today
  { roomTypeId: deluxe!, from: 0, to: 3, guests: 2, rooms: 1, actions: ['CONFIRM', 'CHECK_IN'] }, // in-house
  { roomTypeId: family!, from: 0, to: 1, guests: 4, rooms: 1, actions: ['CONFIRM', 'CHECK_IN'] }, // in-house, departs tomorrow
  { roomTypeId: villa!, from: 3, to: 6, guests: 2, rooms: 1, actions: [] }, // pending
  { roomTypeId: standard!, from: 7, to: 9, guests: 3, rooms: 2, actions: ['CONFIRM'] },
  { roomTypeId: deluxe!, from: 10, to: 12, guests: 1, rooms: 1, actions: ['CANCEL'] },
  { roomTypeId: villa!, from: 14, to: 16, guests: 3, rooms: 1, actions: [] },
];

for (const p of plan) {
  const { reservation } = await createReservation(
    guest,
    { roomTypeId: p.roomTypeId, checkIn: addDays(today, p.from), checkOut: addDays(today, p.to), guests: p.guests, rooms: p.rooms },
    null,
  );
  for (const action of p.actions) await performAction(action === 'CANCEL' ? guest : staff, reservation.id, action, null);
}

console.log(`Seeded ${users.length} users, ${rts.length} room types, ${plan.length} reservations into "${mongoose.connection.name}".`);
for (const a of accounts) console.log(`  ${a.role.padEnd(5)} ${a.email}`);
await disconnectDatabase();
