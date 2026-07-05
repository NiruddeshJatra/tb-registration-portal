# tb-registration-portal

Reusable event-registration portal for Triathlon Bangladesh. v1: Chattogram Duathlon 2026. React + Vite + TS + Tailwind v4 + shadcn/ui (base-ui) + Supabase (Postgres/Auth/RLS). No email/SMS, no payment gateway.

## File Structure

```
supabase/schema.sql          # tables, RLS, register_participant() + admin_register_participant() RPCs, seed data — source of truth
src/
  lib/
    supabase.ts               # Supabase client singleton (reads VITE_SUPABASE_URL/ANON_KEY)
    types.ts                  # DB row types + RPC result/error union types
    format.ts                 # phone/name/email validation — mirrors the SQL functions, keep in sync manually
    constants.ts               # FACEBOOK_PAGE_URL and other hand-filled placeholders
    xlsxExport.ts              # SheetJS wrapper for admin Excel exports
  features/
    register/                 # public 4-step registration wizard (/register/:eventSlug)
      RegisterPage.tsx         # data fetch + wizard state + RPC submit + success/error/closed screens
      formState.ts             # form shape + client-side category matching (matchCategory)
      steps/Step1..4*.tsx       # one component per wizard step
    admin/                     # admin dashboard (/admin/*), guarded by AuthContext session
      AuthContext.tsx           # Supabase Auth session provider
      AdminLayout.tsx           # nav + auth guard (redirects to /admin/login if no session)
      DashboardPage.tsx         # stats (status counts, per-category, per-size, over-time, payment split)
      RegistrationsPage.tsx     # searchable/filterable table + pagination, opens RegistrationDetailDrawer
      ManualAddPage.tsx         # admin manual/group entry, calls admin_register_participant() RPC
      EventConfigPage.tsx       # event settings (open/deadline/max_total_slots/payment) + category CRUD
      ReportsPage.tsx           # jersey pivot / timing-partner / general Excel exports
      useEvents.ts              # shared event-list + selected-event hook used across admin pages
  components/
    ui/                        # shadcn-generated primitives (base-ui backed) — don't hand-edit, re-run shadcn CLI to update
    brand/                     # hand-built brand pieces: StepProgress, RunBikeRunStrip, JerseyChartTable, GoldRing, SimpleLineChart
```

## Key Conventions

- **`register_participant()` (SQL RPC) is the only public write path into `registrations`.** `anon` has zero direct table access (no RLS policy at all on that table for anon) — never add a client-side insert/update against `registrations` for the public form.
- **Admin manual entries go through `admin_register_participant()`**, a separate RPC granted only to `authenticated`. It shares the same `events.reg_counter` atomic sequence for `ref_code` but skips the public-only guards (capacity, phone dedupe).
- **Two atomic capacity guards**, both `pg_advisory_xact_lock`-based: one keyed on the event id (`events.max_total_slots`, e.g. 250 for Chattogram Duathlon 2026), one keyed on the category id (`categories.max_slots`, currently unused/null for all seeded categories but wired up). Don't replace these with a plain `SELECT count(*)` check — that reintroduces the oversell race.
- **Phone/name normalization is duplicated by necessity**: `src/lib/format.ts` (client-side live UI feedback) and the SQL functions (server-side source of truth, since the RPC is the only write path). If you change one, change the other.
- **Theme is permanently dark** — `src/index.css` sets brand colors directly on `:root` (no `.dark` class, no light mode). Don't reintroduce shadcn's light/dark toggle scaffolding.
- **shadcn is configured with the `base` (base-ui) library, not Radix.** `Select`/`RadioGroup` etc.'s `onValueChange` can receive `null` — always coalesce (`v ?? fallback`) rather than passing state setters directly.
- No `react-hook-form`/`zod` — forms are plain `useState` + the validators in `format.ts`, per the locked "no extra UI/form libs" project scope.
- `FACEBOOK_PAGE_URL` in `src/lib/constants.ts` is the only intentionally-hardcoded external link; update it there, not inline.
