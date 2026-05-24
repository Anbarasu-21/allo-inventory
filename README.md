# Allo Inventory Platform — Take-Home Exercise

A Next.js 14 (App Router) inventory and order-fulfillment platform with concurrency-safe reservations.

**Live demo:** _deploy to Vercel and fill this in_  
**Repo:** _link here_

---

## Running locally

### Prerequisites

- Node.js 18+
- A hosted Postgres instance (Supabase, Neon, or Railway — all have free tiers)
- A Redis instance (Upstash free tier works great)

### 1. Clone and install

```bash
git clone <your-repo>
cd allo-inventory
npm install
```

### 2. Environment variables

```bash
cp .env.example .env.local
```

Fill in:

| Variable | Description |
|---|---|
| `DATABASE_URL` | Postgres connection string (with `?pgbouncer=true&connection_limit=1` for Supabase) |
| `DIRECT_URL` | Direct Postgres URL (needed for migrations on Supabase) |
| `REDIS_URL` | Redis connection string (e.g. `rediss://...` for Upstash) |
| `RESERVATION_MINUTES` | How long a reservation holds stock (default: `10`) |
| `CRON_SECRET` | Secret for the Vercel cron endpoint (any random string) |

> **Note:** The app works without Redis — it falls back to Postgres row-level locking alone. Redis adds an extra layer that prevents the DB from being hammered under high concurrency.

### 3. Database setup

```bash
# Push schema to your hosted Postgres
npm run db:push

# Seed with sample products + warehouses
npm run db:seed
```

### 4. Start dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Deployment (Vercel + Supabase + Upstash)

1. Push to GitHub
2. Import to Vercel, set all env vars
3. Vercel auto-detects Next.js — just deploy
4. The `vercel.json` cron config activates automatically on Pro/Hobby plans

---

## How reservation expiry works in production

Three complementary mechanisms ensure expired reservations are released:

### 1. Vercel Cron (primary)

`vercel.json` schedules `GET /api/cron/expire-reservations` to run **every minute**. This endpoint calls `releaseExpiredReservations()` which:

1. Finds all `PENDING` reservations where `expiresAt < now`
2. For each, runs a Postgres transaction that:
   - Re-checks status inside the lock (prevents race with a concurrent confirm)
   - Sets status to `RELEASED`
   - Decrements `StockLevel.reserved`

Maximum stock lock-up from an expired reservation: ~1 minute.

### 2. Lazy cleanup on reads (defence in depth)

Both `GET /api/products` and `GET /api/reservations/:id` call `releaseExpiredReservations()` before returning data. This means even if the cron job fails, stock is corrected the next time anyone loads the product page.

### 3. Expiry check in confirm endpoint

`POST /api/reservations/:id/confirm` checks `expiresAt` inside its `FOR UPDATE` transaction. If the clock has passed, it releases the reservation on the spot and returns 410 — no stale stock can be permanently decremented.

---

## Concurrency strategy

The reservation endpoint (`POST /api/reservations`) uses two layers:

**Layer 1 — Redis distributed lock (`SET NX EX 5000`):**

Before touching the database, we acquire a lock keyed on `${productId}:${warehouseId}`. This serialises requests for the same SKU at a single warehouse, preventing a thundering herd from all reaching the DB simultaneously. If Redis is unavailable, this layer is skipped (fail-open) and we rely on layer 2.

**Layer 2 — Postgres `SELECT ... FOR UPDATE` + Serializable transaction:**

Inside the transaction we issue:

```sql
SELECT id, "totalUnits", reserved
FROM "StockLevel"
WHERE "productId" = $1 AND "warehouseId" = $2
FOR UPDATE
```

This takes an exclusive row lock for the duration of the transaction. Even if two requests arrive at the exact same millisecond (Redis lock collision window), only one can hold the row lock. The stock check (`available = totalUnits - reserved >= quantity`) is therefore atomic.

**Result:** Exactly one of two simultaneous last-unit requests succeeds; the other gets 409. Tested manually by firing concurrent requests.

---

## Idempotency (bonus)

Both `POST /api/reservations` and `POST /api/reservations/:id/confirm` support an optional `Idempotency-Key` header.

**How it works:**

1. On receipt of a request with `Idempotency-Key: <key>`, we check the `IdempotencyRecord` table.
2. If a record exists and hasn't expired (24h TTL), we return the stored `(statusCode, responseBody)` immediately without re-running the logic.
3. If no record exists, we execute normally, then write the result to `IdempotencyRecord` (upsert, so concurrent first-requests don't collide).

**Why Postgres instead of Redis for idempotency?**

The idempotency window is 24 hours — long-lived enough that Redis eviction is a concern. Postgres gives us durable storage for free since we already have it.

**Key naming convention (frontend):**

The ReserveModal generates `reserve-${productId}-${warehouseId}-${Date.now()}` — a fresh key per user intent. This means retrying the same modal submit (e.g. double-click) reuses the key for a short window, but a new "reserve" action gets a new key.

---

## Data model

```
Product ──< StockLevel >── Warehouse
    │                          │
    └───────< Reservation >────┘

StockLevel
  totalUnits   — physical units in the warehouse
  reserved     — units currently held by PENDING reservations
  available    = totalUnits - reserved   (computed, not stored)

Reservation
  status: PENDING | CONFIRMED | RELEASED
  expiresAt: DateTime
```

On **confirm**: `totalUnits -= quantity`, `reserved -= quantity` (the unit is sold).  
On **release/expire**: `reserved -= quantity` only (the unit was never sold).

---

## Trade-offs and things I'd do differently with more time

### What I'd improve

- **Auth**: Zero authentication in this version. In production, reservations would be tied to a user session and only the session owner could confirm/release.

- **Concurrency test suite**: I'd write a proper load test (k6 or autocannon) that fires 50 simultaneous reservation requests for a single-unit SKU and asserts exactly one 201 and N-1 409s.

- **WebSockets / SSE for stock updates**: Currently the product page doesn't update when another user's reservation changes availability. A Supabase Realtime subscription or SSE endpoint would push stock diffs to all connected clients.

- **Reservation queue**: Under extreme load the 429 response (lock busy) could be replaced with a queue. The request waits up to N ms for the lock, then either succeeds or fails gracefully.

- **Idempotency cleanup job**: The `IdempotencyRecord` table will grow unbounded. A cron job pruning records older than 24h should be added alongside the expiry cron.

- **Structured logging + observability**: Replace `console.error` with a structured logger (Pino) and add trace IDs to all requests.

- **Multi-warehouse reservation**: The current API reserves from one specific warehouse. A smarter version would accept just `productId` + `quantity` and automatically pick the nearest/cheapest warehouse.

### Why I chose these technologies

- **Prisma + raw SQL for locking**: Prisma doesn't expose `SELECT ... FOR UPDATE` syntax in its fluent API, so I use `$queryRaw` for the lock acquisition step and Prisma's normal API for everything else. This is a clean compromise.

- **Redis for locking, Postgres for idempotency**: Each tool is used where it's strongest — Redis for sub-millisecond ephemeral coordination, Postgres for durable 24h records.

- **No ORM-level transactions for idempotency store**: Idempotency failures are non-fatal by design — the underlying operation already succeeded. Writing them in a separate, best-effort path keeps the hot path clean.
