# Triathlon Bangladesh — Registration Portal

Reusable event-registration system for Triathlon Bangladesh. v1 ships with **Chattogram Duathlon 2026** (13 Nov 2026) seeded as the first event.

Stack: React 18 + Vite + TypeScript + Tailwind v4 + shadcn/ui (base-ui), Supabase (Postgres + Auth + RLS), SheetJS for client-side Excel export. No email/SMS, no payment gateway — manual bKash/Nagad + Transaction ID verification, same as the previous Google Form flow.

## Setup

Project `tb-registration-portal` (ref `rmlvaalazsideynsvidg`) is already provisioned and the schema below has already been applied to it — steps 1-2 are done for that project. Re-run them only if you're standing up a new environment.

1. **Create a Supabase project.**
2. **Run the schema.** In the Supabase SQL editor, paste and run the entire contents of [`supabase/schema.sql`](supabase/schema.sql). It creates the tables, RLS policies, the `register_participant` / `admin_register_participant` RPCs, and seeds the Chattogram Duathlon 2026 event (fee ৳3500, 250 total slots, 4 categories). Re-running it is safe — the event/category rows upsert instead of erroring.
3. **Disable public signups.** In Supabase Dashboard → Authentication → Settings, turn off "Allow new users to sign up." This is what makes "any authenticated user = admin" safe — there is no public signup path anywhere in this app.
4. **Create admin users.** In Supabase Dashboard → Authentication → Users, manually add one user per admin (email + password). They log in at `/admin/login`.
5. **Configure env vars.** Copy `.env.example` to `.env.local` and fill in your project's URL and anon key:
   ```
   VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY
   ```
6. **Install and run locally:**
   ```
   npm install
   npm run dev
   ```
7. **Deploy to Vercel.** Import the repo, add the two `VITE_SUPABASE_*` env vars in the Vercel project settings, deploy.
8. **Point the subdomain.** In Hostinger DNS, add a CNAME for `register` pointing at the Vercel deployment, then add `register.triathlonbangladesh.com` as a custom domain in the Vercel project.

## Outstanding manual step

The success screen links to the Triathlon Bangladesh Facebook page. The URL was not available while building this, so [`src/lib/constants.ts`](src/lib/constants.ts) has `FACEBOOK_PAGE_URL = null` (renders a "coming soon" placeholder instead of a link). Fill in the real URL there once confirmed.

## Architecture notes

- **The only public write path** into `registrations` is the `register_participant()` Postgres RPC (`SECURITY DEFINER`, granted to `anon`). Anon has no direct table access — no select, no insert, no update, no delete. This is enforced by RLS, not just app code.
- **Atomic capacity guards:** `register_participant()` takes `pg_advisory_xact_lock()` twice — once keyed on the event id (checked against `events.max_total_slots`, e.g. 250 for Chattogram Duathlon 2026) and once keyed on the category id (checked against `categories.max_slots`, unused for v1's categories but available per-category). Concurrent submissions serialize on these locks for the life of the transaction, so neither cap can be oversold.
- **ref_code generation** uses an atomic per-event counter (`events.reg_counter`, incremented via `UPDATE ... RETURNING` inside the same transaction) combined with the event's `short_code`, e.g. `CD26-000042`.
- **Admin manual entries** go through a second RPC, `admin_register_participant()` (granted to `authenticated` only), which reuses the same ref_code counter but skips the public-only guards (capacity, phone dedupe) since admins are trusted and can see slot counts on the dashboard.
- **Validation mirrored client + server side:** Bangladeshi phone normalization (`^01[3-9][0-9]{8}$`, strips `+880`/`880` prefix) and full-name Title Case + `Md.` normalization are implemented independently in `src/lib/format.ts` (for live UI feedback) and in the SQL functions (the source of truth, since the RPC is the only write path).

## What's deliberately not here

Per the locked project scope: no email/SMS of any kind, no payment gateway SDK, no public signup route, no chart or animation libraries (stats charts are hand-rolled inline SVG; step transitions are plain CSS), no invented content — the Facebook URL and anything else not in the original spec is left as a clearly marked placeholder rather than guessed.
