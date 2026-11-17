import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { ReservationModel } from '../../src/models/reservation.model.js';
import { RoomNightModel } from '../../src/models/roomNight.model.js';
import { eachNight } from '../../src/domain/dates.js';
import { auth, book, bookedOn, createRoomType, createUser, inDays, useTestDatabase } from '../helpers.js';

const { app } = useTestDatabase();

describe('simultaneous bookings', () => {
  it('exactly one of 15 concurrent requests gets the last room; the rest get 409', async () => {
    const rt = await createRoomType({ totalInventory: 1 });
    const guests = await Promise.all(Array.from({ length: 15 }, () => createUser(app())));
    const stay = { roomTypeId: rt.id, checkIn: inDays(5), checkOut: inDays(8), guests: 2, rooms: 1 };

    const responses = await Promise.all(guests.map((g) => book(app(), g, stay)));
    const statuses = responses.map((r) => r.status).sort();

    expect(statuses.filter((s) => s === 201)).toHaveLength(1);
    expect(statuses.filter((s) => s === 409)).toHaveLength(14);
    for (const r of responses.filter((x) => x.status === 409)) {
      expect(r.body.error.code).toBe('NO_AVAILABILITY');
    }
    // Ledger and reservations agree; nothing went above inventory or below zero.
    expect(await ReservationModel.countDocuments({ roomType: rt.id })).toBe(1);
    for (const night of eachNight(stay.checkIn, stay.checkOut)) {
      expect(await bookedOn(rt.id, night)).toBe(1);
    }
  });

  it('overlapping multi-night requests never exceed inventory on any night', async () => {
    const rt = await createRoomType({ totalInventory: 3 });
    const ranges: [number, number][] = [
      [10, 13], [11, 14], [12, 15], [10, 12], [13, 16], [11, 12], [12, 13], [14, 16], [10, 16], [15, 16],
      [10, 11], [12, 14],
    ];
    const guests = await Promise.all(ranges.map(() => createUser(app())));
    const responses = await Promise.all(
      ranges.map(([a, b], i) => book(app(), guests[i]!, { roomTypeId: rt.id, checkIn: inDays(a), checkOut: inDays(b), guests: 1, rooms: 1 })),
    );
    expect(responses.every((r) => r.status === 201 || r.status === 409)).toBe(true);
    expect(responses.some((r) => r.status === 409)).toBe(true);

    // For every night: ledger count === rooms held by successful reservations, and <= 3.
    const reservations = await ReservationModel.find({ roomType: rt.id }).lean();
    const nights = await RoomNightModel.find({ roomType: rt.id }).lean();
    for (const night of nights) {
      const holders = reservations.filter((r) => r.checkIn <= night.date && r.checkOut > night.date).length;
      expect(night.booked).toBe(holders);
      expect(night.booked).toBeLessThanOrEqual(3);
      expect(night.booked).toBeGreaterThanOrEqual(0);
    }
  });

  it('a retried request with the same Idempotency-Key creates only one reservation', async () => {
    const rt = await createRoomType({ totalInventory: 5 });
    const guest = await createUser(app());
    const stay = { roomTypeId: rt.id, checkIn: inDays(3), checkOut: inDays(4), guests: 1, rooms: 1 };
    const key = 'retry-key-0001';

    const responses = await Promise.all(Array.from({ length: 5 }, () => book(app(), guest, stay, key)));
    expect(responses.every((r) => r.status === 201 || r.status === 200)).toBe(true);
    const ids = new Set(responses.map((r) => r.body.data.id));
    expect(ids.size).toBe(1);
    expect(await ReservationModel.countDocuments({ guest: guest.id })).toBe(1);
    expect(await bookedOn(rt.id, stay.checkIn)).toBe(1);

    // Same key with a different payload is refused rather than silently replayed.
    const misuse = await book(app(), guest, { ...stay, guests: 2 }, key);
    expect(misuse.status).toBe(422);
    expect(misuse.body.error.code).toBe('IDEMPOTENCY_KEY_REUSED');
  });

  it('concurrent cancellations release inventory only once', async () => {
    const rt = await createRoomType({ totalInventory: 2 });
    const guest = await createUser(app());
    const staff = await createUser(app(), 'STAFF');
    const created = await book(app(), guest, { roomTypeId: rt.id, checkIn: inDays(2), checkOut: inDays(3), guests: 1, rooms: 1 });
    expect(created.status).toBe(201);

    const cancels = await Promise.all([
      request(app()).post(`/api/reservations/${created.body.data.id}/actions`).set(...auth(guest)).send({ action: 'CANCEL' }),
      request(app()).post(`/api/reservations/${created.body.data.id}/actions`).set(...auth(staff)).send({ action: 'CANCEL' }),
      request(app()).post(`/api/reservations/${created.body.data.id}/actions`).set(...auth(guest)).send({ action: 'CANCEL' }),
    ]);
    expect(cancels.filter((r) => r.status === 200)).toHaveLength(1);
    expect(cancels.filter((r) => r.status === 409)).toHaveLength(2);
    expect(await bookedOn(rt.id, inDays(2))).toBe(0);
  });

  it('reducing inventory while bookings race never leaves a night overbooked', async () => {
    const rt = await createRoomType({ totalInventory: 4 });
    const staff = await createUser(app(), 'STAFF');
    const guests = await Promise.all(Array.from({ length: 6 }, () => createUser(app())));
    const stay = { roomTypeId: rt.id, checkIn: inDays(20), checkOut: inDays(21), guests: 1, rooms: 1 };

    const [patch, ...bookings] = await Promise.all([
      request(app()).patch(`/api/room-types/${rt.id}`).set(...auth(staff)).send({ totalInventory: 2 }),
      ...guests.map((g) => book(app(), g, stay)),
    ]);
    const booked = await bookedOn(rt.id, stay.checkIn);
    const night = await RoomNightModel.findById(`${rt.id}:${stay.checkIn}`).lean();
    expect(night).not.toBeNull();
    expect(booked).toBeLessThanOrEqual(night!.total);
    expect(bookings.filter((b) => b.status === 201)).toHaveLength(booked);
    // Either the reduction won (total 2) or it was refused because more were already booked.
    if (patch.status === 200) expect(night!.total).toBe(2);
    else expect(patch.body.error.code).toBe('INVENTORY_BELOW_BOOKED');
  });
});
