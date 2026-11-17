import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { auth, book, createRoomType, createUser, inDays, useTestDatabase } from '../helpers.js';

const { app } = useTestDatabase();

describe('server-side pagination, filtering and sorting', () => {
  it('filters before paginating and returns consistent metadata with a stable order', async () => {
    const rt = await createRoomType({ totalInventory: 50 });
    const [guest, staff] = await Promise.all([createUser(app()), createUser(app(), 'STAFF')]);
    // 12 reservations, all with the same check-in date (ties on the sort field).
    const ids: string[] = [];
    for (let i = 0; i < 12; i++) {
      const r = await book(app(), guest, { roomTypeId: rt.id, checkIn: inDays(3), checkOut: inDays(4), guests: 1 });
      ids.push(r.body.data.id);
    }
    // Cancel 4 of them so the status filter has something to exclude.
    for (const id of ids.slice(0, 4)) {
      await request(app()).post(`/api/reservations/${id}/actions`).set(...auth(staff)).send({ action: 'CANCEL' }).expect(200);
    }

    const seen: string[] = [];
    for (const page of [1, 2, 3]) {
      const res = await request(app())
        .get('/api/reservations')
        .query({ status: 'PENDING', sortBy: 'checkIn', sortOrder: 'asc', page, limit: 3 })
        .set(...auth(staff))
        .expect(200);
      expect(res.body.meta).toMatchObject({ page, limit: 3, total: 8, totalPages: 3 });
      expect(res.body.data.every((r: { status: string }) => r.status === 'PENDING')).toBe(true);
      seen.push(...res.body.data.map((r: { id: string }) => r.id));
    }
    // No duplicates or gaps across pages despite tied sort keys.
    expect(seen).toHaveLength(8);
    expect(new Set(seen).size).toBe(8);
  });

  it('caps the page size', async () => {
    const staff = await createUser(app(), 'STAFF');
    const res = await request(app()).get('/api/reservations').query({ limit: 1000 }).set(...auth(staff));
    expect(res.status).toBe(400);
  });
});
