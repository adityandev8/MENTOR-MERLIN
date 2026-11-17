import { describe, expect, it } from 'vitest';
import request from 'supertest';
import { auth, book, createRoomType, createUser, inDays, useTestDatabase } from '../helpers.js';

const { app } = useTestDatabase();

describe('authorization', () => {
  it("a guest cannot view or cancel another guest's reservation", async () => {
    const rt = await createRoomType({ totalInventory: 3 });
    const [alice, bob] = await Promise.all([createUser(app()), createUser(app())]);
    const created = await book(app(), alice, { roomTypeId: rt.id, checkIn: inDays(3), checkOut: inDays(4), guests: 1 });
    const id = created.body.data.id as string;

    // 404 rather than 403 so ids can't be probed.
    await request(app()).get(`/api/reservations/${id}`).set(...auth(bob)).expect(404);
    await request(app()).post(`/api/reservations/${id}/actions`).set(...auth(bob)).send({ action: 'CANCEL' }).expect(404);

    const bobsList = await request(app()).get('/api/reservations').set(...auth(bob)).expect(200);
    expect(bobsList.body.data).toHaveLength(0);
    const alicesList = await request(app()).get('/api/reservations').set(...auth(alice)).expect(200);
    expect(alicesList.body.data).toHaveLength(1);
  });

  it('staff can see every reservation', async () => {
    const rt = await createRoomType({ totalInventory: 3 });
    const [alice, bob, staff] = await Promise.all([createUser(app()), createUser(app()), createUser(app(), 'STAFF')]);
    await book(app(), alice, { roomTypeId: rt.id, checkIn: inDays(3), checkOut: inDays(4), guests: 1 }).expect(201);
    await book(app(), bob, { roomTypeId: rt.id, checkIn: inDays(3), checkOut: inDays(4), guests: 1 }).expect(201);
    const res = await request(app()).get('/api/reservations').set(...auth(staff)).expect(200);
    expect(res.body.meta.total).toBe(2);
  });

  it('guests cannot use staff endpoints or staff-only actions', async () => {
    const rt = await createRoomType({ totalInventory: 3 });
    const guest = await createUser(app());
    await request(app()).get('/api/admin/dashboard').set(...auth(guest)).expect(403);
    await request(app())
      .post('/api/room-types')
      .set(...auth(guest))
      .send({ name: 'Hack', description: 'Not allowed here', capacity: 2, facilities: [], pricePerNight: 1, totalInventory: 1, isActive: true })
      .expect(403);
    const created = await book(app(), guest, { roomTypeId: rt.id, checkIn: inDays(3), checkOut: inDays(4), guests: 1 });
    const confirm = await request(app()).post(`/api/reservations/${created.body.data.id}/actions`).set(...auth(guest)).send({ action: 'CONFIRM' });
    expect(confirm.status).toBe(403);
  });

  it('requires authentication and rejects forged tokens', async () => {
    await request(app()).get('/api/reservations').expect(401);
    await request(app()).get('/api/reservations').set('Authorization', 'Bearer not.a.jwt').expect(401);
  });

  it('public sign-up cannot grant itself a staff role', async () => {
    const res = await request(app())
      .post('/api/auth/register')
      .send({ name: 'Mallory', email: 'mallory@test.local', password: 'Password123', role: 'ADMIN' })
      .expect(201);
    expect(res.body.data.user.role).toBe('GUEST');
  });

  it('inactive room types are hidden from guests but visible to staff', async () => {
    await createRoomType({ isActive: false });
    await createRoomType({ isActive: true });
    const staff = await createUser(app(), 'STAFF');
    const pub = await request(app()).get('/api/room-types').query({ includeInactive: 'true' }).expect(200);
    expect(pub.body.meta.total).toBe(1);
    const internal = await request(app()).get('/api/room-types').query({ includeInactive: 'true' }).set(...auth(staff)).expect(200);
    expect(internal.body.meta.total).toBe(2);
  });
});
