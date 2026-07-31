# Product Spec — Property Services Operations Platform (Working name: TBD — candidates: Trellis, Rootwork, Jobseed)

**Version:** 1.0 draft · **Date:** 2026-07-31 · **Owner:** Jesse (Effey Tech)
**Status:** Draft for validation with 2–3 prospective design partners

---

## Problem Statement

Small property-services companies (tree care, landscaping, exterior maintenance — typically 3–25 crew, $500K–$5M revenue) run their operations on a patchwork of paper estimates, spreadsheets, texts, and QuickBooks. The owner is the bottleneck: every estimate, invoice, and schedule change flows through one person's head. Incumbent vertical ERPs (Arborgold, Jobber, SingleOps) are either too expensive, too rigid, or miss the specific workflow gaps that create the owner's nightly paperwork burden — most acutely the gap between "job done in the field" and "correct invoice sent and posted to QuickBooks."

The cost of not solving it: owners lose 5–10 hours/week to re-keying, invoices go out days late (hurting cash flow), and revenue leaks when field change-orders never make it onto the bill.

## Product Thesis (wedge-first)

Do not build a full ERP on day one. Enter through the single most painful, highest-frequency workflow — **invoicing** — and expand outward along the job lifecycle. Each phase is independently sellable and independently valuable.

**Phase 1 (v1, this spec): Invoice Composer** — from job notes to a correct, professional invoice posted to QuickBooks Online in under 2 minutes.
**Phase 2: Estimating** — replaces the spreadsheet estimating tool; estimates convert to jobs, jobs convert to invoices.
**Phase 3: Job & crew workflow** — scheduling, work orders, field completion notes, change orders.
**Phase 4: Owner's dashboard** — margin per job, AR aging, crew utilization.

Everything below specs **Phase 1** unless marked otherwise.

## Goals

1. **Time-to-invoice under 2 minutes** from "job marked done" to invoice sent, vs. a current baseline of hours-to-days (measured per design partner).
2. **Invoices out same-day** for ≥90% of completed jobs within 60 days of adoption.
3. **Zero re-keying into QuickBooks** — 100% of invoices created in the product post to QBO without manual duplication.
4. **Capture billable extras**: ≥1 recovered change-order/add-on per customer per month that would previously have gone unbilled (self-reported, then measured once Phase 3 exists).
5. **Business goal:** 2 paying customers at $150–$300/mo within 90 days of v1 (design-partner pricing), proving willingness to pay before Phase 2 is built.

## Non-Goals (v1)

- **No scheduling/dispatch.** Phase 3. Owners already limp along with calendars; invoicing is the sharper pain.
- **No estimating engine.** Phase 2. v1 accepts line items typed or picked from a price list; it does not compute estimates.
- **No QuickBooks Desktop support.** QBD is sunsetting; QBO-only keeps the integration surface small. Desktop-only prospects are asked to migrate first.
- **No payments processing in v1.** QBO invoices already carry Intuit's pay links; building our own payments is P2.
- **No multi-tenant self-serve onboarding.** v1 is white-glove onboarded by the founder. Self-serve is premature before 5 customers.
- **No mobile app.** Mobile-responsive web only. Native apps are a Phase 3+ decision.

## Target Users / Personas

- **Owner-operator ("Jim"):** runs sales, oversees crews, does the books at night. Primary buyer and primary user.
- **Office admin (part-time spouse/bookkeeper):** cleans up QuickBooks, chases payments. Secondary user.
- **Crew lead (Phase 3):** future source of field completion data; in v1 their input arrives as texts/photos the owner transcribes.

## User Stories (v1, priority order)

- As an **owner**, I want to assemble an invoice from a saved price list and free-form lines so that billing a finished job takes minutes, not an evening.
- As an **owner**, I want the invoice pushed to QuickBooks Online automatically so that my books stay correct without typing anything twice.
- As an **owner**, I want customer details pulled from QBO (or created there when new) so that I never maintain two customer lists.
- As an **owner**, I want to attach before/after photos and job notes to the invoice record so that disputes are settled by evidence, not memory.
- As an **owner**, I want a "jobs done but not yet invoiced" list so that nothing finished ever sits unbilled.
- As an **office admin**, I want to see invoice status (draft / sent / paid, synced from QBO) so that I know who to chase without opening two systems.
- As an **owner**, I want an add-on/change-order line flagged distinctly so that extra work done in the field reliably makes it onto the bill.
- *(Edge)* As an **owner**, when the QBO sync fails, I want the invoice preserved locally with a clear retry so that no work is lost and I know it has NOT been posted.

## Requirements

### Must-Have (P0)

**P0-1. QuickBooks Online integration (customers, items, invoices)**
- OAuth connect to a QBO company; read customers and items; create/update invoices; read invoice status (sent/viewed/paid).
- *Acceptance:* Given a connected QBO account, when an invoice is finalized in-app, then it appears in QBO within 60 seconds with matching customer, lines, totals, and tax; status changes in QBO reflect in-app within 15 minutes.
- *Constraint:* QBO API — writes are effectively free, reads are metered; design sync to minimize polling (webhooks + on-demand refresh).

**P0-2. Invoice Composer**
- Build an invoice from: saved price-list items, free-form lines, quantity × rate, per-line notes, photo attachments, and a flagged "added on site" line type.
- *Acceptance:* An owner with a 50-item price list can produce and send a 6-line invoice, including one photo and one change-order line, in under 2 minutes without touching QBO directly.

**P0-3. Price list / service catalog**
- CRUD for the company's services and materials with default rates and units; importable from CSV or from existing QBO items.
- *Acceptance:* Given an existing QBO items list, when the owner connects, then the catalog is pre-populated and editable.

**P0-4. Uninvoiced-work queue**
- A simple list of jobs marked "done, not invoiced" (created manually in v1), sorted oldest-first, with one-click "compose invoice."
- *Acceptance:* Nothing can be removed from the queue except by invoicing it or explicitly dismissing it with a reason.

**P0-5. Sync-failure safety**
- All invoice data persists locally first; QBO push is retryable; failures are visibly flagged, never silent.
- *Acceptance:* Given QBO is unreachable, when an invoice is finalized, then it is saved with status "not posted," the owner sees a clear banner, and retry succeeds without duplicating the invoice in QBO (idempotency key).

### Nice-to-Have (P1)

- **P1-1. Invoice templates/branding** — logo, terms, payment instructions on the PDF/email.
- **P1-2. AR nudge list** — overdue invoices (from QBO status) with one-click reminder email drafts.
- **P1-3. Photo-to-line-item assist** — AI suggestion of line items from job photos/notes; owner always confirms. (Differentiator, but not required for the core loop.)
- **P1-4. Basic reporting** — invoiced-this-month, average days-to-invoice, change-order revenue captured.

### Future Considerations (P2)

- Estimating engine (Phase 2) — architecture note: price-list/catalog must be shared between estimating and invoicing; design the catalog as its own service now.
- Job/work-order model (Phase 3) — the v1 "job" is deliberately minimal (name, customer, done-date, notes); keep it extensible.
- Payments beyond Intuit's links; crew mobile capture; scheduling; multi-company/franchise support.

## Success Metrics

**Leading (first 30 days per customer):** activation = first invoice posted to QBO within 7 days of onboarding (target: 100% of design partners); ≥70% of that customer's invoices created through the product by day 30; median time-to-invoice < 2 min.
**Lagging (60–90 days):** same-day invoicing rate ≥90%; ≥1 captured change-order/customer/month; renewal past the design-partner period at full price; measurable drop in owner's reported "paperwork hours/week" (baseline interview vs. day-60 interview).
**Kill/pivot signal:** if design partners revert to manual QBO invoicing for >50% of jobs by day 30, the wedge is wrong — reassess before building Phase 2.

## Technical Notes & Constraints

- **Stack (opinionated, current):** TypeScript end-to-end — Next.js (App Router) + tRPC/REST, Postgres (Neon or Supabase), Prisma/Drizzle, hosted on Vercel or Fly.io; background jobs via Inngest or a simple queue for QBO sync; object storage (S3/R2) for photos. Boring, cheap (< $50/mo at v1 scale), one-person maintainable.
- **QBO integration is the riskiest component.** Build and demo the OAuth + invoice-create loop first, before any UI polish (de-risking spike, week 1).
- **Multi-tenancy from day one** (org-scoped rows), even though onboarding is white-glove — retrofitting tenancy is far more expensive than including it.
- **Data ownership:** every customer's data exportable as CSV at any time; this is a selling point to owner-operators burned by lock-in.

## Go-to-Market Notes (build-to-sell)

- Sell to the **vertical**, not to one buyer: any tree care / landscaping / exterior-services SMB already on QBO is a prospect. Design-partner offer: 90 days at $150/mo, white-glove setup, weekly feedback call, price locks at $250–$300/mo after.
- Proof assets by end of v1: a 3-minute demo video of the 2-minute invoice loop, and one written before/after case study (hours saved, days-to-invoice).
- The existing estimating spreadsheet and workflow research remain valuable as **Phase 2 source material** and as sales collateral demonstrating domain understanding.

## Open Questions

- **(Blocking — founder)** Which 2–3 real businesses will be design partners? v1 should not be built without at least one committed.
- **(Blocking — founder/legal)** Confirm no signed agreement with the prior client restricts reuse of generic workflow concepts. Keep all of his company-specific data (pricing, customer names, photos, transcripts) out of the product and its marketing.
- **(Non-blocking — engineering)** QBO sales-tax handling (automated sales tax vs. manual rates) — resolve during the integration spike.
- **(Non-blocking — product)** Does the uninvoiced queue start manual-entry only, or also ingest from a shared calendar? Decide after first design-partner interview.

## Timeline (aggressive but honest, solo builder part-time)

- **Weeks 1–2:** QBO integration spike (OAuth, create invoice, idempotent retry). Go/no-go on the whole plan lives here.
- **Weeks 3–6:** Invoice Composer + catalog + queue, deployed, first design partner onboarded.
- **Weeks 7–10:** Photos, statuses, P1 polish based on partner feedback; second partner onboarded.
- **Week 12:** Case study + demo video; decide Phase 2 (estimating) vs. more distribution.

**Dependencies:** Texas LLC filed + business bank account before charging anyone (already on the checklist); Intuit developer account + app review for production QBO keys (start the review early — it has lead time).
