import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { auth, book, bookedOn, createRoomType, createUser, inDays, today, useTestDatabase } from '../helpers.js';

const { app } = useTestDatabase();

const act = (id: string, user: Parameters<typeof auth>[0], action: string) =>
  request(app()).post(`/api/reservations/${id}/actions`).set(...auth(user)).send({ action });

describe('reservation lifecycle via the API', () => {
  it('runs the full Pending → Confirmed → Checked-in → Checked-out flow', async () => {
    const rt = await createRoomType({ totalInventory: 2 });
    const [guest, staff] = await Promise.all([createUser(app()), createUser(app(), 'STAFF')]);
    const created = await book(app(), guest, { roomTypeId: rt.id, checkIn: today(), checkOut: inDays(2), guests: 1 });
    const id = created.body.data.id as string;
    // Arrival is today, so the guest can no longer self-cancel (staff still can).
    expect(created.body.data.allowedActions).toEqual([]);

    // Can't skip straight to check-in.
    const skip = await act(id, staff, 'CHECK_IN');
    expect(skip.status).toBe(409);
    expect(skip.body.error.code).toBe('INVALID_TRANSITION');

    expect((await act(id, staff, 'CONFIRM').expect(200)).body.data.status).toBe('CONFIRMED');
    const checkedIn = await act(id, staff, 'CHECK_IN').expect(200);
    expect(checkedIn.body.data.status).toBe('CHECKED_IN');
    expect(checkedIn.body.data.allowedActions).toEqual(['CHECK_OUT']);

    // Cancelling an in-house stay is not allowed.
    expect((await act(id, staff, 'CANCEL')).status).toBe(409);

    // Early check-out (leaving on day 0 of 2) releases the unused nights.
    expect(await bookedOn(rt.id, today())).toBe(1);
    const out = await act(id, staff, 'CHECK_OUT').expect(200);
    expect(out.body.data.status).toBe('CHECKED_OUT');
    expect(out.body.data.statusHistory.map((h: { status: string }) => h.status)).toEqual(['PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT']);
    expect(await bookedOn(rt.id, today())).toBe(0);
    expect(await bookedOn(rt.id, inDays(1))).toBe(0);

    // Terminal state.
    expect((await act(id, staff, 'CHECK_OUT')).status).toBe(409);
  });

  it('cannot check in before the arrival date', async () => {
    const rt = await createRoomType();
    const [guest, staff] = await Promise.all([createUser(app()), createUser(app(), 'STAFF')]);
    const created = await book(app(), guest, { roomTypeId: rt.id, checkIn: inDays(3), checkOut: inDays(4), guests: 1 });
    await act(created.body.data.id, staff, 'CONFIRM').expect(200);
    const res = await act(created.body.data.id, staff, 'CHECK_IN');
    expect(res.status).toBe(409);
  });

  it('guest cancellation frees the room for someone else', async () => {
    const rt = await createRoomType({ totalInventory: 1 });
    const [a, b] = await Promise.all([createUser(app()), createUser(app())]);
    const stay = { roomTypeId: rt.id, checkIn: inDays(5), checkOut: inDays(6), guests: 1 };
    const first = await book(app(), a, stay).expect(201);
    await book(app(), b, stay).expect(409);
    await act(first.body.data.id, a, 'CANCEL').expect(200);
    await book(app(), b, stay).expect(201);
  });

  it('staff cannot reduce inventory below rooms already booked', async () => {
    const rt = await createRoomType({ totalInventory: 2 });
    const [a, b, staff] = await Promise.all([createUser(app()), createUser(app()), createUser(app(), 'STAFF')]);
    const stay = { roomTypeId: rt.id, checkIn: inDays(5), checkOut: inDays(6), guests: 1 };
    await book(app(), a, stay).expect(201);
    await book(app(), b, stay).expect(201);
    const res = await request(app()).patch(`/api/room-types/${rt.id}`).set(...auth(staff)).send({ totalInventory: 1 });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVENTORY_BELOW_BOOKED');
    // Increasing works and immediately opens availability.
    await request(app()).patch(`/api/room-types/${rt.id}`).set(...auth(staff)).send({ totalInventory: 3 }).expect(200);
    const c = await createUser(app());
    await book(app(), c, stay).expect(201);
  });
});
