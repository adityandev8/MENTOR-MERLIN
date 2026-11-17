/**
 * Live demonstration against a *running* API: N different guests try to book the last room
 * at the same instant. Expected: exactly one 201, everyone else 409 NO_AVAILABILITY.
 *
 *   npm run demo:concurrency            # 10 guests
 *   npm run demo:concurrency -- 25      # 25 guests
 *
 * Creates a throw-away room type with inventory 1 and deactivates it afterwards.
 */
import { randomUUID } from 'node:crypto';
import type { ApiResponse, AuthResult, ReservationDTO, RoomTypeDTO } from '@hotel/shared';
import { addDays, todayInTimeZone } from '../src/domain/dates.js';

const API = process.env.DEMO_API_URL ?? 'http://localhost:4000';
const contenders = Number(process.argv[2] ?? 10);
const staffEmail = process.env.DEMO_STAFF_EMAIL;
const staffPassword = process.env.DEMO_STAFF_PASSWORD;
if (!staffEmail || !staffPassword || staffPassword.startsWith('<')) {
  console.error('Set DEMO_STAFF_EMAIL and DEMO_STAFF_PASSWORD in server/.env (run `npm run seed` first).');
  process.exit(1);
}

async function call<T>(method: string, path: string, body?: unknown, token?: string, extra: Record<string, string> = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...extra },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: res.status, body: (await res.json()) as ApiResponse<T> };
}

function data<T>(r: { body: ApiResponse<T> }): T {
  if (!r.body.success) throw new Error(`${r.body.error.code}: ${r.body.error.message}`);
  return r.body.data;
}

const staff = data(await call<AuthResult>('POST', '/api/auth/login', { email: staffEmail, password: staffPassword }));
const roomType = data(
  await call<RoomTypeDTO>(
    'POST',
    '/api/room-types',
    {
      name: `Last Room Demo ${randomUUID().slice(0, 6)}`,
      description: 'Temporary room type created by the concurrency demo.',
      capacity: 2,
      facilities: [],
      pricePerNight: 5000,
      totalInventory: 1,
      isActive: true,
    },
    staff.token,
  ),
);

const guests = await Promise.all(
  Array.from({ length: contenders }, async (_, i) =>
    data(
      await call<AuthResult>('POST', '/api/auth/register', {
        name: `Racer ${i + 1}`,
        email: `racer-${randomUUID().slice(0, 8)}@demo.local`,
        password: 'DemoPass123',
      }),
    ),
  ),
);

const today = todayInTimeZone(process.env.HOTEL_TIMEZONE ?? 'Asia/Kolkata');
const stay = { roomTypeId: roomType.id, checkIn: addDays(today, 30), checkOut: addDays(today, 33), guests: 2, rooms: 1 };
console.log(`\n${contenders} guests booking the single "${roomType.name}" for ${stay.checkIn} → ${stay.checkOut} simultaneously…\n`);

const started = performance.now();
const results = await Promise.all(
  guests.map(async (g) => {
    const t0 = performance.now();
    const r = await call<ReservationDTO>('POST', '/api/reservations', stay, g.token, { 'Idempotency-Key': randomUUID() });
    return { guest: g.user.name, status: r.status, ms: Math.round(performance.now() - t0), outcome: r.body.success ? r.body.data.reference : r.body.error.code };
  }),
);
console.table(results);

const winners = results.filter((r) => r.status === 201).length;
const losers = results.filter((r) => r.status === 409).length;
console.log(`\n${winners} confirmed hold(s), ${losers} rejected with 409, ${results.length - winners - losers} other — ${Math.round(performance.now() - started)} ms total`);
console.log(winners === 1 ? '✔ No overbooking.' : '✘ Unexpected result!');

await call('PATCH', `/api/room-types/${roomType.id}`, { isActive: false }, staff.token);
process.exit(winners === 1 ? 0 : 1);
