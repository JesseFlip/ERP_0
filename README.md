# PropertyOps — Invoice Composer (v1)

Phase 1 of the Property Services Operations Platform spec (`PropertyOps_ERP_Spec.md`):
take a finished job from field notes to a correct, QuickBooks Online invoice in under
two minutes, with nothing ever silently lost if the QBO push fails.

## Stack

- **Next.js 16** (App Router, TypeScript)
- **tRPC v11** + React Query for a type-safe API layer
- **PostgreSQL** via **Prisma 7** (driver-adapter client, org-scoped rows on every table)
- **QuickBooks Online** REST API — OAuth2 connect, customer/item sync, idempotent invoice push, webhook-driven status updates, and a cron-polled retry queue for failures
- **S3/R2-compatible object storage** for before/after photos, with a zero-config local-disk fallback for dev
- Session auth via signed cookies (`jose`) + `bcryptjs` — no external auth provider needed for white-glove onboarding

See `PropertyOps_ERP_Spec.md` for the full product spec this implements.

## Getting started

```bash
npm install                 # also runs `prisma generate`
docker compose up -d        # local Postgres on :5432
cp .env.example .env        # DATABASE_URL already matches docker-compose.yml
npm run db:migrate          # creates tables
npm run db:seed             # demo org, catalog, customers, uninvoiced jobs
npm run dev
```

Sign in at `http://localhost:3000/login` with the demo account the seed script prints:

```
owner@demo.propertyops.app / demo1234
```

## QuickBooks Online

The app runs without QBO configured — you can log jobs, build the price list, and
compose invoices locally. To exercise the real integration:

1. Create an app at [developer.intuit.com](https://developer.intuit.com), grab the
   sandbox `Client ID` / `Client Secret`.
2. Set `QBO_CLIENT_ID`, `QBO_CLIENT_SECRET`, and `QBO_REDIRECT_URI` in `.env`
   (`http://localhost:3000/api/qbo/oauth/callback` for local dev).
3. In **Settings**, click **Connect QuickBooks**. Customers and items pull in
   automatically on connect.
4. For live status updates (sent/viewed/paid), register a webhook in the Intuit
   developer portal pointing at `/api/qbo/webhook` and set
   `QBO_WEBHOOK_VERIFIER_TOKEN` to match.

### Idempotency

QBO's REST API has no request-idempotency header. Each locally-created invoice gets
a stable `idempotencyKey`; before creating an invoice in QBO we embed that key in the
invoice's `PrivateNote` and query for an existing match first. A retried push (after a
timeout, a crashed retry job, etc.) adopts the prior QBO invoice instead of billing the
customer twice. See `src/lib/qbo/client.ts`.

### Sync failures are never silent

`src/lib/qbo/sync.ts` persists the invoice locally first; a failed push flags the
invoice `NOT_POSTED` with the error visible on the invoice page and queues a
`SyncJob` with exponential backoff. `/api/cron/qbo-sync` (wired up in `vercel.json`
as a 10-minute Vercel Cron) drains that queue; the invoice page also has a manual
**Retry now** button.

## Data model

`prisma/schema.prisma` — every business table carries `orgId` from day one
(multi-tenant from the start, per the spec, even though onboarding stays white-glove).
Core entities: `Org`, `User`, `Customer`, `CatalogItem` (the shared price list —
designed to be reused by Phase 2 estimating), `Job` (deliberately minimal:
name/customer/done-date/notes), `Invoice` + `InvoiceLine`, `Attachment`, `SyncJob`.

## Data export

Every org's customers and invoices are exportable as CSV at any time
(`/api/export/customers.csv`, `/api/export/invoices.csv`) — a deliberate
anti-lock-in selling point called out in the spec.

## Project layout

```
prisma/                   schema, migrations, seed
src/lib/qbo/               OAuth, REST client, sync/retry orchestration
src/lib/{auth,crypto,storage,prisma}.ts   session, token encryption, uploads, db client
src/server/trpc/           tRPC routers (catalog, customers, jobs, invoices, qbo, uploads, dashboard)
src/app/(app)/             authenticated app shell: dashboard, queue, invoices, catalog, customers, settings
src/app/api/qbo/           OAuth start/callback + webhook routes
src/app/api/cron/          retry-queue cron endpoint
src/proxy.ts                route protection (Next.js 16 renamed middleware → proxy)
```

## Deploying

Target is Vercel (per the spec's "boring, cheap, one-person maintainable" stack) with
a managed Postgres (Neon/Supabase). Set every variable from `.env.example` in the
Vercel project, then `vercel.json`'s cron picks up the retry queue automatically —
just add a `CRON_SECRET` env var and Vercel signs its cron requests with it.

```bash
npm run build   # `next build`, also type-checks
npm run lint
```
