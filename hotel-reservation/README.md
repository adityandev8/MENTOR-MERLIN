# Mentor Merlin — Hotel Reservation & Front Desk Management

A single-hotel reservation system built with **MongoDB, Express, React and Node.js, in TypeScript end to end**.
Guests browse rooms, search availability and book; staff manage room inventory, reservations, check-in and check-out.

The core of the project is the booking path: availability, capacity, pricing, ownership and status transitions are all enforced on the server, and **simultaneous bookings for the last room cannot overbook** (proven by automated tests and a live demo script).

---

## Contents

1. [Quick start](#1-quick-start)
2. [Project layout](#2-project-layout)
3. [Features by role](#3-features-by-role)
4. [Reservation rules and lifecycle](#4-reservation-rules-and-lifecycle)
5. [Availability and concurrency design](#5-availability-and-concurrency-design)
6. [Data model and indexes](#6-data-model-and-indexes)
7. [REST API](#7-rest-api)
8. [Testing](#8-testing)
9. [Production readiness and scaling](#9-production-readiness-and-scaling)
10. [Trade-offs and known limitations](#10-trade-offs-and-known-limitations)

---

## 1. Quick start

**Requirements:** Node.js ≥ 20.10 (tested on 22), npm ≥ 10, and a MongoDB **replica set** (transactions need one). Three ways to get one are below — pick one.

```bash
# 1. Install (also builds the shared types package)
npm install

# 2. Configure the API
cp server/.env.example server/.env
#    then edit server/.env:
#      JWT_SECRET            -> a long random string (command in the file)
#      SEED_*_PASSWORD       -> passwords for the demo accounts
#      DEMO_STAFF_PASSWORD   -> same as SEED_STAFF_PASSWORD

# 3. Start MongoDB (choose ONE)
npm run db:local          # a) zero-install: single-node replica set on :27017 (keep this terminal open)
docker compose up -d      # b) Docker: mongo:7 as replica set rs0 on :27017
                          # c) MongoDB Atlas: put your mongodb+srv:// URI in MONGO_URI

# 4. Load demo data (resets the database; refuses to run in production)
npm run seed

# 5. Run API and web app (two terminals)
npm run dev:server        # http://localhost:4000
npm run dev:client        # http://localhost:5173  (proxies /api to the API)
```

Sign in at <http://localhost:5173/login> with the accounts printed by the seed:

| Role  | Email                    | Where they land      |
|-------|--------------------------|----------------------|
| Admin | `admin@hotel.local`      | Staff console        |
| Staff | `frontdesk@hotel.local`  | Staff console        |
| Guest | `guest@hotel.local`      | My reservations      |

The seed creates reservations relative to *today* (one arrival due, two in-house, pending ones, a cancelled one) so the dashboard and front desk have something on them.

```bash
npm test                         # all unit + integration tests (in-memory replica set; never touches your DB)
npm run demo:concurrency -- 20   # 20 guests race for the last room against the running API
npm run typecheck                # tsc across shared, server and client
npm run build                    # production builds
```

> `npm run db:local` and `npm test` use `mongodb-memory-server`, which downloads a `mongod` binary on first run (~100 MB, cached afterwards). If your network blocks that, use Docker/Atlas for the app and set `MONGOMS_SYSTEM_BINARY=/path/to/mongod` for tests.

---

## 2. Project layout

An npm-workspaces monorepo. The `shared` package holds the API contract both sides compile against, so a change to a DTO breaks the build on whichever side is out of date.

```
shared/src/            API envelope, DTOs, enums (statuses, actions, roles) — types + a few constants only
server/src/
  config/env.ts        Env vars validated with zod at boot (fail fast)
  db/                  Connection (pooling, timeouts) and runInTransaction (bounded retries)
  models/              Mongoose schemas + indexes: User, RoomType, RoomNight, Reservation
  repositories/        inventory.repository.ts — the only code that writes the inventory ledger
  domain/              Pure business rules, no I/O: dates, stay validation, pricing, lifecycle
  services/            Use cases: auth, room types, availability, reservations, dashboard
  validators/          zod schemas for every body/query
  controllers/         HTTP in/out only: parse → call service → send envelope
  middleware/          auth (JWT + roles), error handler, rate limits, request id + logging
  routes/index.ts      Route table
  app.ts / server.ts   App factory (used by tests) / process entry with graceful shutdown
server/tests/          unit/ and integration/ (vitest + supertest + in-memory replica set)
server/scripts/        seed, local replica set, index sync, concurrency demo
client/src/
  api/                 Single HTTP client (envelope unwrapping, typed ApiError) + typed endpoints
  auth/                Session context
  hooks/               TanStack Query hooks (all server state) and URL-synced list state
  components/          Reusable UI (ui/*) and domain components (RoomRow, ReservationTable…)
  layouts/ pages/      Guest site and staff console
```

**Where the business logic lives.** Rules live in `server/src/domain` (pure, unit-tested) and are applied in `server/src/services`. The React app holds none of them: it shows the price the server quotes, renders exactly the buttons listed in each reservation's server-computed `allowedActions`, and route guards exist only to choose which screen to show — every endpoint authorises independently.

---

## 3. Features by role

**Guest site**
- **Home / Rooms** — active room types with description, capacity, facilities and nightly price (illustrated placeholders when no image URL is set). Server-paginated and sortable.
- **Availability** — check-in, check-out, guests, rooms. Lists room types that can fit the party, with rooms free on *every* night of the stay and the server-calculated total. Sold-out types are shown as sold out rather than hidden.
- **Room details / booking** — dates, party, night count and total come from `GET /room-types/:id/quote`. Booking sends an `Idempotency-Key`, so double-clicks and retries can't create two reservations.
- **Register / Sign in**
- **My reservations** — own reservations only, filter by status, server-paginated; detail page with history and cancel (when allowed).

**Staff console** (`/staff`, STAFF or ADMIN)
- **Today** — arrivals today, arrivals still to check in, departures due, in-house reservations, occupied rooms / occupancy, pending confirmations.
- **Front desk** — work queues: *Arrivals* (confirm / check in / cancel), *In house* and *Departures* (check out).
- **Reservations** — every reservation; search by reference or guest-email prefix; filter by status, room type, check-in range, "staying on" date; sortable; server-paginated; detail page with actions and history.
- **Rooms** — create, edit, open/close (activate/deactivate) room types and change inventory.

Every important screen has loading, empty, error (with retry) and success states.

---

## 4. Reservation rules and lifecycle

| Rule | Where it's enforced |
|---|---|
| Check-out after check-in; no past check-in; max 30 nights; book up to 365 days ahead | `domain/stay.ts` (400 `INVALID_DATES`) |
| Guests ≤ capacity × rooms; at least one guest per room | `reservation.service.ts`, inside the booking transaction (422 `CAPACITY_EXCEEDED`) |
| Enough rooms on **every** night of the range | `inventory.repository.ts#holdNights` (409 `NO_AVAILABILITY`, with the short nights listed) |
| Nights and total computed on the server from the stored price | `domain/pricing.ts`; the request schema is `.strict()` so a client-sent `totalAmount`/`status` is rejected with 400 |
| Price snapshot | `pricePerNight` and `totalAmount` are stored on the reservation; later price changes don't affect it |
| Guests see / act on only their own reservations | Owner filter comes from the JWT; others' reservations return **404** (not 403) so ids can't be probed |
| No overbooking, no negative inventory | Conditional updates in the ledger + transactions (section 5) |

"Today" is computed in the hotel's time zone (`HOTEL_TIMEZONE`, default Asia/Kolkata), not the server's. Dates are `YYYY-MM-DD` in the API and UTC-midnight `Date`s in MongoDB, so they never shift between zones.

### Lifecycle

```
PENDING ──CONFIRM──▶ CONFIRMED ──CHECK_IN──▶ CHECKED_IN ──CHECK_OUT──▶ CHECKED_OUT
   │                     │
   └───────CANCEL────────┴──▶ CANCELLED            (CHECKED_OUT and CANCELLED are terminal)
```

| Action | Who | Allowed when |
|---|---|---|
| CONFIRM | staff | PENDING and the stay hasn't ended |
| CANCEL | owner guest | PENDING/CONFIRMED and today is **before** the check-in date |
| CANCEL | staff | PENDING/CONFIRMED at any time (e.g. no-shows) |
| CHECK_IN | staff | CONFIRMED and check-in date ≤ today < check-out date |
| CHECK_OUT | staff | CHECKED_IN (early departure releases the unused nights) |

Anything else is a 409 `INVALID_TRANSITION` (or 403 for a guest attempting a staff action). The rules are one pure function (`domain/lifecycle.ts`) used both to **validate** a transition and to compute each reservation's `allowedActions` for the UI, so the two can't drift apart.

**Confirmation policy.** Inventory is **held at creation**: a PENDING reservation already counts against availability, so confirming never needs a fresh availability check and can't fail for lack of rooms. Pending is the hotel's chance to verify the booking (e.g. payment) before committing. Set `AUTO_CONFIRM_BOOKINGS=true` to create bookings directly as CONFIRMED. Cancelling releases the held nights in the same transaction as the status change.

Every change is appended to `statusHistory` with who did it and when.

---

## 5. Availability and concurrency design

### The inventory ledger

Instead of counting overlapping reservations at booking time, the system keeps **one document per room type per night** (`room_nights`):

```js
{ _id: "<roomTypeId>:2026-11-20", roomType, date, total: 8, booked: 5 }   // invariant: 0 ≤ booked ≤ total
```

- `_id` is deterministic, so two requests that need the same night always address the **same document**, and uniqueness comes from the primary key — it doesn't depend on a secondary index having been built.
- Availability for a stay = `min(total − booked)` over its nights. One `$in` lookup by `_id`, at most 30 × (room types on the page) small documents.
- Rows are created lazily the first time a night is booked (nights with no row are fully free).

### Booking = one transaction

`createReservation` runs inside a MongoDB multi-document transaction (snapshot read concern, majority write concern):

1. Read the room type **inside the transaction** — active flag, capacity and price come from the DB, never the request.
2. Upsert the ledger row for every night (`$setOnInsert` only — existing rows untouched).
3. **Atomic conditional increment** across the nights:
   ```js
   updateMany({ _id: { $in: nightIds }, $expr: { $lte: [{ $add: ['$booked', rooms] }, '$total'] } },
              { $inc: { booked: rooms } })
   ```
   If `modifiedCount` ≠ number of nights, at least one night was short → throw 409 `NO_AVAILABILITY`. The transaction aborts, which **rolls back the nights that were incremented**, so a multi-night hold is all-or-nothing.
4. Insert the reservation with the price snapshot.
5. Commit.

### Why two requests can't both get the last room

Both requests increment the same `room_nights` document. MongoDB's storage engine allows only one transaction to write a document that another in-flight transaction has written: the second gets a **WriteConflict** (labelled `TransientTransactionError`) and aborts. Our `runInTransaction` retries it from scratch; on retry it reads the committed ledger, the `$expr` condition no longer matches, and the request returns **409 `NO_AVAILABILITY`** with the unavailable nights. The `$expr` guard means even a non-transactional write path could never push `booked` above `total`; the transaction is what makes several nights move together.

### What the losing request gets, and retries

| Outcome | Response |
|---|---|
| Lost the race, room gone | `409 NO_AVAILABILITY` + `details.unavailableNights: [{date, available}]` |
| Kept losing write conflicts 5 times in a row (extreme contention) | `503 BUSY_RETRY` — safe to retry |
| Network dropped after the server committed, client retried with the same `Idempotency-Key` | `200` with the **original** reservation (`Idempotent-Replayed: true`); no second hold |
| Same key reused for a *different* stay | `422 IDEMPOTENCY_KEY_REUSED` |

Server-side retries are **bounded** (5 attempts, exponential backoff with full jitter starting at 15 ms) rather than the driver's `withTransaction` default of retrying for up to 120 s, so a hot spot can't pin HTTP requests. Idempotency is enforced by a unique partial index on `(guest, idempotencyKey)`: if two retries race, the loser hits the index, its transaction (including its inventory hold) rolls back, and it returns the winner's reservation. The web app generates one key per stay selection, so double-clicking "Reserve" is harmless.

### The other writers

- **Cancel / early check-out** — release nights with `$inc: { booked: -rooms }` guarded by `booked ≥ rooms` (never negative), in the same transaction as a status update that is conditional on the status we validated against (`findOneAndUpdate({ _id, status: <previous> })`). Three simultaneous cancels → one 200, two 409s, inventory released once (tested).
- **Staff changing inventory** — in one transaction, upsert every night in the booking window with the new `total`, then reject with 409 `INVENTORY_BELOW_BOOKED` if any current/future night has `booked > total`. Upserting *every* night (not only existing rows) matters: a booking lazily creating a night row and a staff reduction then write the **same `_id`** and conflict, instead of the booking creating a row with the old total after the reduction committed (a write-skew anomaly). Tested with a reduction racing six bookings.

### Consistency boundary and assumptions

- The boundary is **one replica set**. The ledger and reservations are always updated in the same transaction, so the ledger equals the sum of active holds (the integration tests check this invariant night by night after concurrent runs).
- Requires a replica set or sharded cluster (MongoDB ≥ 4.4; tested on 7.0) — transactions are unavailable on a standalone `mongod`.
- Reads for search/quote are outside transactions and may be a few milliseconds stale; that's fine because the booking transaction re-checks everything authoritatively.
- Correctness does not depend on secondary indexes, but `(guest, idempotencyKey)` dedupe does — run `npm run db:indexes` on deploy (auto-indexing is on outside production).

### Demonstration

```bash
npm run demo:concurrency -- 20
```

Creates a throw-away room type with one room, registers 20 guests, fires 20 bookings for overlapping dates at once and prints each result. Output from a real run:

```
20 guests booking the single "Last Room Demo 30649e" for 2026-12-03 → 2026-12-06 simultaneously…
│ 'Racer 2'  │ 201 │ 'HTL-2611-9PQVD3'   │
│ 'Racer 1'  │ 409 │ 'NO_AVAILABILITY'   │   … ×19
1 confirmed hold(s), 19 rejected with 409, 0 other — 499 ms total
✔ No overbooking.
```

---

## 6. Data model and indexes

| Collection | Key fields | Notes |
|---|---|---|
| `users` | name, email (lower-cased), passwordHash (bcrypt, `select: false`), role `GUEST`/`STAFF`/`ADMIN`, timestamps | Public sign-up always creates GUEST; staff are provisioned by seed/admin |
| `roomtypes` | name, description, capacity, facilities[], pricePerNight, totalInventory, isActive, imageUrl, timestamps | Prices are **integers in whole currency units** (exact arithmetic, no floats) |
| `room_nights` | `_id = roomTypeId:date`, roomType, date, total, booked | The inventory ledger (section 5) |
| `reservations` | reference (`HTL-YYMM-XXXXXX`), guest, guestName/guestEmail snapshot, roomType, roomTypeName snapshot, checkIn, checkOut, nights, guests, roomCount, pricePerNight snapshot, totalAmount, currency, status, statusHistory[], idempotencyKey, releasedFrom, timestamps | Snapshots keep history accurate and let staff search without `$lookup` |

### Index choices

| Index | Serves |
|---|---|
| `users { email: 1 }` unique | Login lookup; duplicate sign-ups → 409 |
| `roomtypes { name: 1 }` unique, case-insensitive collation | No two room types with the same name |
| `roomtypes { isActive: 1, pricePerNight: 1, _id: 1 }` | Guest catalogue and availability search: equality on `isActive`, sorted by price, `_id` tie-break for stable pages |
| `room_nights _id` | All ledger reads/writes are exact `_id` or `_id`-range (ISO dates sort lexicographically) — no secondary index needed |
| `reservations { reference: 1 }` unique | Lookup by reference; prefix search (`^HTL-2611`) uses it |
| `reservations { guest: 1, createdAt: -1, _id: -1 }` | "My reservations": equality on guest then the default sort — no in-memory sort |
| `reservations { guest: 1, idempotencyKey: 1 }` unique, partial (string keys only) | Retry-safe booking |
| `reservations { createdAt: -1, _id: -1 }` and `{ status: 1, createdAt: -1, _id: -1 }` | Staff list default sort, with and without a status filter |
| `reservations { status: 1, checkIn: 1 }` / `{ status: 1, checkOut: 1 }` | Dashboard counts and front-desk queues (equality on status, range on date — ESR order) |
| `reservations { checkIn: 1, _id: 1 }` | Check-in range filter / sort without a status |
| `reservations { guestEmail: 1 }` | Staff search by email prefix |

Writes to `reservations` are rare relative to reads, so a handful of targeted compound indexes is a good trade. Each one maps to a real screen; I'd verify with `explain()` on production-like data and drop any the planner never picks.

### Pagination

Every list endpoint paginates **in the database**: filters go into the query, then `sort → skip → limit`, and `countDocuments` runs on the same filter, returning `{ page, limit, total, totalPages, hasNextPage, hasPrevPage }`. Every sort has `_id` appended as a unique tie-breaker, so rows never repeat or vanish between pages when the sort field ties (tested with 12 reservations sharing a check-in date). `limit` is capped at 50. The client sends `page`/`limit`/filters (kept in the URL so views are shareable) and renders only the page it gets back. At very large offsets, keyset (cursor) pagination on the same indexes would replace `skip`.

---

## 7. REST API

All responses use one envelope:

```jsonc
{ "success": true,  "data": …, "meta": { "page": 1, "limit": 10, "total": 42, "totalPages": 5, "hasNextPage": true, "hasPrevPage": false } }
{ "success": false, "error": { "code": "NO_AVAILABILITY", "message": "…", "details": …, "requestId": "…" } }
```

| Method & path | Auth | Purpose |
|---|---|---|
| `POST /api/auth/register` · `POST /api/auth/login` · `GET /api/auth/me` | –, –, any | Accounts and session (JWT bearer) |
| `GET /api/room-types` | optional | Paginated list (`page, limit, sortBy, sortOrder, q, includeInactive` — inactive only for staff) |
| `GET /api/room-types/:id` | optional | One room type (inactive → 404 for guests) |
| `GET /api/room-types/:id/quote` | – | Server price + availability for `checkIn, checkOut, guests, rooms` |
| `POST /api/room-types` · `PATCH /api/room-types/:id` | staff | Create / edit / activate / deactivate / change inventory |
| `GET /api/availability` | – | Paginated availability search |
| `POST /api/reservations` | guest | Book (`roomTypeId, checkIn, checkOut, guests, rooms`; optional `Idempotency-Key` header) |
| `GET /api/reservations` | any | Guests: own only. Staff: all, with `status, q, roomTypeId, checkInFrom, checkInTo, stayDate, sortBy, sortOrder, page, limit` |
| `GET /api/reservations/:id` | any | Detail (owner or staff) |
| `POST /api/reservations/:id/actions` | any | `{ action: CONFIRM \| CANCEL \| CHECK_IN \| CHECK_OUT, note? }` |
| `GET /api/admin/dashboard` | staff | Today's counts |
| `GET /api/admin/front-desk?view=arrivals\|in-house\|departures` | staff | Paginated work queues |
| `GET /health/live` · `GET /health/ready` | – | Liveness / readiness (pings MongoDB) |

Status codes: 200/201, 400 validation, 401 unauthenticated, 403 wrong role, 404 not found (including other guests' reservations), 409 conflict (availability, transition, inventory, duplicates), 422 capacity / idempotency misuse, 429 rate limited, 503 busy-retry, 500 opaque internal error (details logged, never sent).

---

## 8. Testing

```bash
npm test
```

Vitest starts a throw-away **in-memory MongoDB replica set** (so transactions are real); every test file gets its own database. Nothing touches a development or production database.

| File | What it proves |
|---|---|
| `unit/domain.test.ts` | Price calculation; date maths incl. year/leap boundaries; "today" in the hotel time zone; stay validation; every lifecycle transition, guest vs staff, date gates |
| `integration/concurrency.test.ts` | **15 guests race for the last room → exactly one 201, fourteen 409s**, ledger = 1; 12 overlapping multi-night requests on 3 rooms → every night's `booked` equals the holding reservations and never exceeds 3; 5 concurrent retries with one Idempotency-Key → one reservation; 3 concurrent cancels → inventory released once; inventory reduction racing bookings → never overbooked |
| `integration/booking.test.ts` | Server-side total from stored price; tampered `totalAmount`/`status` rejected; price snapshot survives a price change; past / inverted dates; capacity; overlap rejected when exhausted and partial hold rolled back; back-to-back stays allowed; inactive room types; availability search |
| `integration/authorization.test.ts` | Guest can't view/cancel another guest's reservation (404) or see it in lists; staff see all; guests blocked from staff endpoints and staff-only actions; missing/forged tokens → 401; sign-up can't self-assign a role; inactive room types hidden from guests |
| `integration/lifecycle.test.ts` | Full Pending → Confirmed → Checked-in → Checked-out flow via the API; skipping states rejected; check-in before arrival rejected; early check-out releases nights; cancellation frees the room for another guest; inventory can't drop below booked |
| `integration/pagination.test.ts` | Status filter applied before pagination, correct metadata, no duplicates or gaps across pages with tied sort keys; page size cap |

Current result: **6 files, 37 tests passing**; the concurrency file was run repeatedly without a flake.

---

## 9. Production readiness and scaling

### Stateless API

No session or booking state lives in process memory: auth is a signed JWT, and all booking state is in MongoDB, guarded by transactions. Any number of API instances can run behind a load balancer, and an instance can die mid-request safely — an uncommitted transaction is simply aborted by the server, and the client's retry with the same `Idempotency-Key` either completes or replays. Graceful shutdown on SIGTERM stops accepting connections, lets in-flight requests finish (15 s cap) and closes the pool.

The one process-local piece is the **rate-limit counter** (`express-rate-limit` memory store), which makes limits per instance. With several instances, switch to a shared store (e.g. `rate-limit-redis`), or enforce limits at the gateway.

### Scaling the API

- **Horizontal instances** behind a load balancer; `TRUST_PROXY=true` so client IPs are correct. `keepAliveTimeout` is set above typical LB idle timeouts.
- **Connection pooling**: `MONGO_MAX_POOL_SIZE` per instance (default 20). Total connections = instances × pool size; keep that within the cluster's limit (or add more mongos routers when sharded).
- **Bounded work per request**: `maxTimeMS` (5 s) on list queries, 5 s server-selection timeout, 30 s socket timeout, 30 s HTTP request timeout, 100 kB body limit, page size capped at 50.

### Scaling the database

- **Indexes and query shape** (section 6): every list is an index-backed equality + sort; the ledger is all `_id` lookups. Contention is per *(room type, night)*, so bookings for different room types or dates never conflict with each other.
- **Replication**: a 3-member replica set (`w: majority` writes) for durability and failover. Search/catalogue reads could be sent to secondaries with `readPreference: secondaryPreferred` since they are re-checked at booking time; bookings always read the primary.
- **Caching where safe**: the room-type catalogue changes rarely and could be cached (CDN or Redis, invalidated on staff edits). Availability and prices shown on the booking page are never trusted from a cache — the booking transaction is authoritative regardless.
- **Data growth**: `room_nights` grows by room types × 365 per year (≈ 2k rows/year for this hotel); past nights can be archived. Reservations grow linearly; old checked-out/cancelled ones can move to an archive collection. For a hotel *chain*, shard `reservations` by `{ hotelId, … }` and `room_nights` by `{ roomType/hotelId }` so a booking's transaction stays on one shard.

### Bottlenecks and failure scenarios

| Scenario | Mitigation in this codebase | Next step at larger scale |
|---|---|---|
| Traffic spike / flash sale on one room type | Contention is isolated to that room type's nights; losers fail fast with 409 after a short bounded retry; per-user booking rate limit | Queue bookings for that room type (one consumer) if conflict retries dominate; autoscale API on CPU/latency |
| Slow database | Query `maxTimeMS`, server-selection and socket timeouts so requests fail instead of piling up; `/health/ready` fails so the LB stops routing | Alert on p95 latency and pool wait time; scale the cluster tier |
| Duplicate requests (double-click, client retry, LB retry) | `Idempotency-Key` + unique index → same reservation returned, no second hold | — |
| Instance restart / crash mid-booking | Transaction never commits → nothing held; graceful shutdown drains on deploys | — |
| Transient errors (primary failover, write conflicts, network) | Bounded jittered transaction retries; `retryWrites`; commit retried on `UnknownTransactionCommitResult` | — |
| Abandoned PENDING holds | Staff cancel from the dashboard's pending count | A scheduled job to expire unconfirmed PENDING holds after N hours |
| Brute-force sign-in | Failed attempts limited per IP (20 / 15 min) | Shared store + account lockout / CAPTCHA |

**Observability**: structured JSON logs (pino) with a request id on every line, reused from an incoming `X-Request-Id` or generated, returned in the response header and in every error body, so a user's error can be traced to its log lines. Authorization headers and password fields are redacted.

### Secrets

All configuration comes from environment variables validated at boot. `server/.env.example` and `client/.env.example` contain placeholders only; `.env` is git-ignored.

---

## 10. Trade-offs and known limitations

- **Ledger vs counting overlaps.** Counting overlapping reservations inside a transaction also works but needs a lock document per room type to avoid write skew, which serialises *all* bookings for that room type. The per-night ledger gives finer-grained contention (only shared nights conflict) and O(nights) availability reads, at the cost of a second collection that must stay in sync — which is why only `inventory.repository.ts` writes it, always inside the same transaction as the reservation change.
- **Room types, not physical rooms.** Inventory is a count per room type; assigning room numbers at check-in would be a natural next step (a `rooms` collection and an assignment at CHECK_IN).
- **JWT in `localStorage`.** Simple and stateless, but readable by injected scripts. An httpOnly cookie with CSRF protection is the hardening path. Role changes take effect when the token expires (12 h by default).
- **Deactivating a room type** stops new bookings; existing reservations are kept and must be managed by staff.
- **Booking window**: stays must end within `BOOKING_WINDOW_DAYS` (365); inventory changes materialise that window plus two days so the window boundary at midnight can't race.
- **Staff can't book on behalf of walk-in guests** in this version (the booking endpoint is GUEST-only); it would need a guest picker and an "on behalf of" field.
- **Guest same-day cancellation**: guests can't self-cancel on or after the arrival date; the front desk handles it.
- No payments, email notifications or React Native app (optional in the brief).
