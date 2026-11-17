import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { auth, book, bookedOn, createRoomType, createUser, inDays, useTestDatabase } from '../helpers.js';

const { app } = useTestDatabase();

describe('booking rules', () => {
  it('calculates nights and total on the server from the stored price', async () => {
    const rt = await createRoomType({ pricePerNight: 3500, capacity: 2, totalInventory: 5 });
    const guest = await createUser(app());
    const res = await book(app(), guest, { roomTypeId: rt.id, checkIn: inDays(4), checkOut: inDays(7), guests: 3, rooms: 2 });

    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ nights: 3, roomCount: 2, pricePerNight: 3500, totalAmount: 21_000, status: 'PENDING' });
    expect(res.body.data.reference).toMatch(/^HTL-\d{4}-[A-Z2-9]{6}$/);
  });

  it('rejects a client-supplied price/total/status instead of trusting it', async () => {
    const rt = await createRoomType();
    const guest = await createUser(app());
    const res = await book(app(), guest, {
      roomTypeId: rt.id, checkIn: inDays(4), checkOut: inDays(5), guests: 1, rooms: 1, totalAmount: 1, status: 'CONFIRMED',
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('keeps the price snapshot when the room price changes later', async () => {
    const rt = await createRoomType({ pricePerNight: 2000, totalInventory: 3 });
    const guest = await createUser(app());
    const staff = await createUser(app(), 'STAFF');
    const created = await book(app(), guest, { roomTypeId: rt.id, checkIn: inDays(4), checkOut: inDays(6), guests: 1, rooms: 1 });
    await request(app()).patch(`/api/room-types/${rt.id}`).set(...auth(staff)).send({ pricePerNight: 9000 }).expect(200);
    const fetched = await request(app()).get(`/api/reservations/${created.body.data.id}`).set(...auth(guest)).expect(200);
    expect(fetched.body.data.totalAmount).toBe(4000);
  });

  it('rejects past dates and check-out on/before check-in', async () => {
    const rt = await createRoomType();
    const guest = await createUser(app());
    const past = await book(app(), guest, { roomTypeId: rt.id, checkIn: inDays(-1), checkOut: inDays(2), guests: 1 });
    const inverted = await book(app(), guest, { roomTypeId: rt.id, checkIn: inDays(5), checkOut: inDays(5), guests: 1 });
    expect(past.status).toBe(400);
    expect(past.body.error.code).toBe('INVALID_DATES');
    expect(inverted.status).toBe(400);
    expect(inverted.body.error.code).toBe('INVALID_DATES');
  });

  it('rejects a party larger than room capacity', async () => {
    const rt = await createRoomType({ capacity: 2, totalInventory: 5 });
    const guest = await createUser(app());
    const res = await book(app(), guest, { roomTypeId: rt.id, checkIn: inDays(2), checkOut: inDays(3), guests: 3, rooms: 1 });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('CAPACITY_EXCEEDED');
  });

  it('rejects an overlapping booking once inventory is exhausted, but allows back-to-back stays', async () => {
    const rt = await createRoomType({ totalInventory: 1 });
    const [a, b] = await Promise.all([createUser(app()), createUser(app())]);
    await book(app(), a, { roomTypeId: rt.id, checkIn: inDays(10), checkOut: inDays(13), guests: 1 }).expect(201);

    const overlap = await book(app(), b, { roomTypeId: rt.id, checkIn: inDays(12), checkOut: inDays(14), guests: 1 });
    expect(overlap.status).toBe(409);
    expect(overlap.body.error.code).toBe('NO_AVAILABILITY');
    expect(overlap.body.error.details.unavailableNights).toEqual([{ date: inDays(12), available: 0 }]);
    // Partial hold on night 13 was rolled back with the failed transaction.
    expect(await bookedOn(rt.id, inDays(13))).toBe(0);

    // Checking in on the day the previous guest checks out is fine (check-out is exclusive).
    await book(app(), b, { roomTypeId: rt.id, checkIn: inDays(13), checkOut: inDays(15), guests: 1 }).expect(201);
  });

  it('does not book inactive room types', async () => {
    const rt = await createRoomType({ isActive: false });
    const guest = await createUser(app());
    const res = await book(app(), guest, { roomTypeId: rt.id, checkIn: inDays(2), checkOut: inDays(3), guests: 1 });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ROOM_TYPE_INACTIVE');
  });

  it('availability search reports rooms free on every night of the range', async () => {
    const rt = await createRoomType({ totalInventory: 2, capacity: 2 });
    await createRoomType({ capacity: 1, totalInventory: 9 }); // too small for 2 guests → filtered out
    const guest = await createUser(app());
    await book(app(), guest, { roomTypeId: rt.id, checkIn: inDays(6), checkOut: inDays(7), guests: 1 }).expect(201);

    const res = await request(app())
      .get('/api/availability')
      .query({ checkIn: inDays(5), checkOut: inDays(8), guests: 2 })
      .expect(200);
    expect(res.body.meta.total).toBe(1);
    expect(res.body.data[0]).toMatchObject({ availableRooms: 1, isAvailable: true, nights: 3 });
  });
});
