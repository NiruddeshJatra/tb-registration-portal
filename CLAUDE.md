# tb-registration-portal

Reusable event-registration portal for Triathlon Bangladesh. v1: Chattogram Duathlon 2026. React + Vite + TS + Tailwind v4 + shadcn/ui (base-ui) + Supabase (Postgres/Auth/RLS). No email/SMS, no payment gateway.

## File Structure

```
supabase/schema.sql          # tables, RLS, register_participant() + admin_register_participant() RPCs, seed data — source of truth
supabase/migrations/         # incremental, idempotent SQL for the already-provisioned live DB (applied manually, not by this repo)
src/
  lib/
    supabase.ts               # Supabase client singleton (reads VITE_SUPABASE_URL/ANON_KEY)
    types.ts                  # DB row types + RPC result/error union types
    format.ts                 # phone/name/email/txid validation — mirrors the SQL functions, keep in sync manually
    errorMessages.ts           # Bangla text for every RegisterParticipantError code, shared across public + admin forms
    constants.ts               # FACEBOOK_PAGE_URL, TRIATHLON_BANGLADESH_URL and other hand-filled placeholders
    xlsxExport.ts              # SheetJS wrapper for admin Excel exports
  features/
    register/                 # public 4-step registration wizard (/register/:eventSlug)
      RegisterPage.tsx         # data fetch + wizard state + RPC submit + success/error/closed screens; desktop split layout (poster panel + wizard-shell glass card)
      formState.ts             # form shape + client-side category matching (matchCategory)
      steps/Step1..4*.tsx       # one component per wizard step
    admin/                     # admin dashboard (/admin/*), guarded by AuthContext session
      AuthContext.tsx           # Supabase Auth session provider
      AdminLayout.tsx           # nav + auth guard (redirects to /admin/login if no session)
      DashboardPage.tsx         # stats (status counts, revenue, per-category, per-size, over-time, payment split), CountUp on all figures
      RegistrationsPage.tsx     # searchable/filterable table + pagination, opens RegistrationDetailDrawer
      ManualAddPage.tsx         # admin manual/group entry, calls admin_register_participant() RPC; live per-field validation mirrors the public wizard; navigates to /admin/registrations on success
      EventConfigPage.tsx       # event settings (open/deadline/max_total_slots/payment) + category CRUD
      ReportsPage.tsx           # jersey pivot / timing-partner / general Excel exports
      useEvents.ts              # shared event-list + selected-event hook used across admin pages
  components/
    ui/                        # shadcn-generated primitives (base-ui backed) — don't hand-edit, re-run shadcn CLI to update
      calendar.tsx               # EXCEPTION: hand-rolled month/year grid, NOT shadcn-generated — no react-day-picker dep. Don't run shadcn CLI on this one, it'll pull that dependency back in.
      popover.tsx                # thin @base-ui/react/popover wrapper, same pattern as dialog.tsx/select.tsx
    brand/                     # hand-built brand pieces: StepProgress, RunBikeRunStrip, JerseyChartTable, GoldRing, SimpleLineChart, BrandLoader, CountUp, DateOfBirthPicker
```

## Key Conventions

- **`register_participant()` (SQL RPC) is the only public write path into `registrations`.** `anon` has zero direct table access (no RLS policy at all on that table for anon) — never add a client-side insert/update against `registrations` for the public form.
- **Admin manual entries go through `admin_register_participant()`**, a separate RPC granted only to `authenticated`. It shares the same `events.reg_counter` atomic sequence for `ref_code` but skips the public-only guards (capacity, phone dedupe).
- **Two atomic capacity guards**, both `pg_advisory_xact_lock`-based: one keyed on the event id (`events.max_total_slots`, e.g. 250 for Chattogram Duathlon 2026), one keyed on the category id (`categories.max_slots`, currently unused/null for all seeded categories but wired up). Don't replace these with a plain `SELECT count(*)` check — that reintroduces the oversell race.
- **Phone/name normalization is duplicated by necessity**: `src/lib/format.ts` (client-side live UI feedback) and the SQL functions (server-side source of truth, since the RPC is the only write path). If you change one, change the other.
- **Theme is permanently dark** — `src/index.css` sets brand colors directly on `:root` (no `.dark` class, no light mode). Don't reintroduce shadcn's light/dark toggle scaffolding.
- **shadcn is configured with the `base` (base-ui) library, not Radix.** `Select`/`RadioGroup` etc.'s `onValueChange` can receive `null` — always coalesce (`v ?? fallback`) rather than passing state setters directly. Also unlike Radix, base-ui's `<Select.Value>` does NOT read the label off the mounted `<SelectItem>` — it needs an explicit `items={[{value, label}, ...]}` prop on the `<Select>` root, or the trigger displays the raw value (e.g. a UUID or an "__all__" sentinel) instead of the item's text. Required wherever the value isn't already human-readable (ids, filter sentinels).
- No `react-hook-form`/`zod` — forms are plain `useState` + the validators in `format.ts`, per the locked "no extra UI/form libs" project scope.
- `FACEBOOK_PAGE_URL` and `TRIATHLON_BANGLADESH_URL` in `src/lib/constants.ts` are the only intentionally-hardcoded external links; update them there, not inline.
- `src/lib/errorMessages.ts` holds the Bangla translations for every `RegisterParticipantError` code returned by both RPCs — shared by the public wizard and the admin manual-add form. Add new error codes there, not as inline maps.
- **`CREATE OR REPLACE FUNCTION` does NOT let you add a new parameter to an existing RPC in place** — Postgres identifies a function by name + input argument types, so adding one (even with a default) creates a second overload alongside the old signature instead of replacing it. `admin_register_participant`'s `p_amount_paid` param hit this live: had to `drop function` the old 22-arg signature explicitly. Any future RPC signature change needs the same explicit drop-old-signature step in its migration.
- **Design system lives in `src/index.css`**: the layered background (`body::before`/`::after` grid + grain, `#root` at `z-index:1`) is global; the glassmorphism/blur treatment is scoped to `.wizard-shell` (public wizard only — admin stays flat/utilitarian per its own density-over-decoration goal). Reuse `.wizard-shell`, `.btn-sheen`, `.status-chip-*`, `.admin-page-header`, and the `animate-*` keyframes already defined there rather than inventing new ad hoc animation classes.
- `supabase/migrations/0003_validation_amount.sql` has been applied to the live DB (amount_paid column, transaction_id nullable, tightened format checks as `NOT VALID`, new RPC signatures). Future migrations still follow the same "written here, applied manually" convention — don't assume a new migration file is live until confirmed.
