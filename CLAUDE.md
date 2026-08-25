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
      RegisterPage.tsx         # data fetch + wizard state + RPC submit + success/error/closed screens; "Start Line" identity-rail (dark ink panel) + form-column layout; blur-based `touched` map passed to steps
      SuccessScreen.tsx        # the race "bib" — drawn SVG border + PENDING stamp; successor to the retired GoldRing
      formState.ts             # form shape + client-side category matching (matchCategory)
      steps/Step1..4*.tsx       # one component per wizard step
      steps/fields.tsx          # shared FieldLabel/FieldError + inputBorder() helper for the wizard steps
    admin/                     # admin dashboard (/admin/*), guarded by AuthContext session
      AuthContext.tsx           # Supabase Auth session provider
      AdminLayout.tsx           # nav + auth guard (redirects to /admin/login if no session)
      DashboardPage.tsx         # stats (status counts, revenue, per-category, per-size, over-time, payment split), CountUp on all figures
      RegistrationsPage.tsx     # searchable/filterable table + pagination, opens RegistrationDetailDrawer
      ManualAddPage.tsx         # admin manual/group entry, calls admin_register_participant() RPC; 3 grouped sections (Athlete/Classification/Payment), blur-based validation; on success stays on page + shows an inline "Added · REF" banner
      EventConfigPage.tsx       # event settings (open/deadline/max_total_slots/payment) + category CRUD
      ReportsPage.tsx           # jersey pivot / timing-partner / general Excel exports
      useEvents.ts              # shared event-list + selected-event hook used across admin pages
  components/
    ui/                        # shadcn-generated primitives (base-ui backed) — don't hand-edit, re-run shadcn CLI to update
      calendar.tsx               # EXCEPTION: hand-rolled month/year grid, NOT shadcn-generated — no react-day-picker dep. Don't run shadcn CLI on this one, it'll pull that dependency back in.
      popover.tsx                # thin @base-ui/react/popover wrapper, same pattern as dialog.tsx/select.tsx
    brand/                     # hand-built brand pieces: RouteProgress (race-distance step bar; `legs` prop relabels the three segments per event), TapTile (roving-tabindex radiogroup tiles), DashLoader (marching-dash — the ONLY spinner), CountUp, DateOfBirthPicker (themed popover, public + compact admin)
```

## Key Conventions

- **`register_participant()` (SQL RPC) is the only public write path into `registrations`.** `anon` has zero direct table access (no RLS policy at all on that table for anon) — never add a client-side insert/update against `registrations` for the public form.
- **Admin manual entries go through `admin_register_participant()`**, a separate RPC granted only to `authenticated`. It shares the same `events.reg_counter` atomic sequence for `ref_code` but skips the public-only guards (capacity, phone dedupe).
- **Two atomic capacity guards**, both `pg_advisory_xact_lock`-based: one keyed on the event id (`events.max_total_slots`, e.g. 250 for Chattogram Duathlon 2026), one keyed on the category id (`categories.max_slots`, currently unused/null for all seeded categories but wired up). Don't replace these with a plain `SELECT count(*)` check — that reintroduces the oversell race.
- **Phone/name normalization is duplicated by necessity**: `src/lib/format.ts` (client-side live UI feedback) and the SQL functions (server-side source of truth, since the RPC is the only write path). If you change one, change the other.
- **Two visual systems, one codebase ("Start Line" / "Night Ops").** `src/index.css` `:root` is the LIGHT public palette (warm paper `#F1EFE6`, ink `#15180E`, chartreuse `#C6F53F`); `.dark` is the admin palette (near-black `#0B0D08`). Every admin surface is wrapped in `.dark` at its route boundary (`AdminLayout`, `AdminLoginPage`). `--radius: 0` everywhere — corners are cut, not rounded; don't patch `rounded-*` back in. Do NOT reintroduce the old "permanently dark `:root`" model.
- **Portalled overlays escape the `.dark` wrapper.** base-ui `Select`/`Sheet`/`Dialog` portal their popups to `<body>` (outside the admin `.dark` div → they'd inherit the light `:root`). So those three primitives' popups carry a hard-coded `dark` class. All current usage is admin-only; if you ever use them on a public (light) surface, revisit that. The `DateOfBirthPicker` popover is inline (not portaled), so it inherits its surface theme correctly.
- **shadcn is configured with the `base` (base-ui) library, not Radix.** `Select`/`RadioGroup` etc.'s `onValueChange` can receive `null` — always coalesce (`v ?? fallback`) rather than passing state setters directly. Also unlike Radix, base-ui's `<Select.Value>` does NOT read the label off the mounted `<SelectItem>` — it needs an explicit `items={[{value, label}, ...]}` prop on the `<Select>` root, or the trigger displays the raw value (e.g. a UUID or an "__all__" sentinel) instead of the item's text. Required wherever the value isn't already human-readable (ids, filter sentinels).
- No `react-hook-form`/`zod` — forms are plain `useState` + the validators in `format.ts`, per the locked "no extra UI/form libs" project scope.
- `FACEBOOK_PAGE_URL` and `TRIATHLON_BANGLADESH_URL` in `src/lib/constants.ts` are the only intentionally-hardcoded external links; update them there, not inline.
- `src/lib/errorMessages.ts` holds the Bangla translations for every `RegisterParticipantError` code returned by both RPCs — shared by the public wizard and the admin manual-add form. Add new error codes there, not as inline maps.
- **`CREATE OR REPLACE FUNCTION` does NOT let you add a new parameter to an existing RPC in place** — Postgres identifies a function by name + input argument types, so adding one (even with a default) creates a second overload alongside the old signature instead of replacing it. `admin_register_participant`'s `p_amount_paid` param hit this live: had to `drop function` the old 22-arg signature explicitly. Any future RPC signature change needs the same explicit drop-old-signature step in its migration.
- **Design system lives in `src/index.css`**: tokens (`:root`/`.dark`), the 10 `sl-*` keyframes, and reusable classes — `.sl-paper` (public bg), `.sl-card` (bib-white + 7px hard shadow), `.sl-tile` (tap tile), `.sl-stripe` (chartreuse caution stripe), `.sl-skeleton` (shimmer), `.status-chip-*` (bordered+tinted), `.admin-page-header`. Reuse these rather than inventing ad-hoc classes. The only two infinite animations are the admin skeleton shimmer and the dashed loader march; everything else plays once. (Retired: `.wizard-shell`, `.btn-sheen`, the layered grid/grain background, `GoldRing`, `StepProgress`, `RunBikeRunStrip`, `SimpleLineChart`, `JerseyChartTable`, `BrandLoader`.)
- **≤8-option choices on the public wizard are `TapTileGroup`, not `<Select>`/`<RadioGroup>`** (gender, blood group, jersey size, payment method). Real `<button role="radio">` tiles with roving tab-index. Admin forms keep native/`<Select>`s.
- **Public "slots claimed" = approved count via `public_event_slots(slug)` RPC** (SECURITY DEFINER, granted `anon`) — `anon` can't read `registrations` directly. Don't substitute `events.reg_counter` (that counts all ref codes, not approved).
- **Payment methods are `bKash | Nagad | Rocket | Upay`** (`PaymentMethod` type, the `chk` on `registrations.payment_method`, and `events.payment_methods`). Public tiles render from `event.payment_methods`; keep the three in sync.
- `admin_register_participant()` now has a friendly single-add dup-phone guard (`entry_source <> 'group_import'`); group imports may still share a phone. `transaction_id` accepts 8–15 chars (was 8–12) — mirrored in `format.ts`, `chk_txid`, and both RPCs.
- **Events are feature-flagged, not special-cased.** Five booleans on `events` drive every per-event difference in the public wizard — `requires_bike_type` (MTB / Road-TT tiles + the BIKE CHECK-IN rail line), `collects_strava_link` (optional activity-URL field), `manual_category_select` (athlete picks a distance instead of age/gender auto-match), `is_virtual` (no DATE line, distance strip built from the event's own categories, no pro-jersey fit warning, "T-shirt" wording). All five are editable from Admin → Event config. Add a flag rather than branching on a slug or event name.
- **`register_participant()` resolves the category two ways, and the event's flag — not the caller — picks which.** `manual_category_select` events require `p_category_id` (verified to belong to the event and match the submitted gender); every other event does the age+gender auto-match and REJECTS a supplied id outright. That rejection is a security guard, not tidiness: honouring a caller-chosen id on an auto-match event let a public caller put themselves in any age bracket or fee they liked. `manual_category_select` categories all share min_age 0 / max_age null, so auto-match there would silently return the lowest `display_order` row (every 21K entrant stored as 5K, wrong fee).
- **`requires_bike_type` is enforced server-side too** (`bike_type_required`), not just by the step-2 tiles — the RPC is the only public write path, so a client-only check is no check. `admin_register_participant()` deliberately does NOT enforce it: admins enter non-runners and legacy rows. `matchCategory()` is still the auto path; `resolveCategory(event, categories, form)` in `formState.ts` picks between the two and is what both `RegisterPage` and the wizard steps call.
- **Distance-per-gender categories are intentional duplicates.** `categories.gender` is NOT NULL, so a distance-based event needs one row per (distance × gender) — six rows for 5K/10K/21K. `distinctCategoryNames()` dedupes them down to the three tiles the athlete sees.
- **A `values (...)` list of all-NULLs types as `text`.** The virtual-run category seed needed `null::int` on the first `max_age` or the insert fails with `column "max_age" is of type integer but expression is of type text`. Cast the first row whenever a seed column is null throughout.
- **Migrations `0003`–`0009` are all applied to the live DB.** `0004` (Rocket/Upay) + `0005` (txid 8–15, venue/fee/methods refresh, `public_event_slots`, dup-phone guard), `0006` (bike type + Strava columns, both RPCs re-signed, duathlon moved to 6 Nov 2026, Chatto Metro Virtual Run seeded), `0007` (`is_virtual` + the virtual run's t-shirt chart), `0008` (its fee note) and `0009` (category-id + bike-type guards, from code review) were applied via the Supabase MCP against project `tb-registration-portal`. `0006` went in as four numbered steps (`0006a`–`0006d`) because each MCP call is its own transaction. Future migrations follow the same "written here, applied manually" convention — don't assume a new file is live until confirmed.
- **`index.html` `<head>` carries the OG/Twitter share meta + `SportsEvent` JSON-LD for Chattogram Duathlon 2026**, sourced from `public/duathlon-og.jpg` (1200×630). Keep event facts (date, venue, fee) in sync with the `events` row in `supabase/schema.sql` if they change. After any deploy that changes this image or meta, re-scrape the URL in Facebook Sharing Debugger — shares cache the old preview otherwise.
