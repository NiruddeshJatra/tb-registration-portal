# Handoff: TB Registration Portal — "Start Line / Night Ops" Redesign

## Overview
Visual redesign of the register.triathlonbangladesh.com registration portal for the Chattogram Duathlon 2026 (10K run + 40K bike + 5K run). Two visual systems on one codebase:
- **Start Line** (public wizard + success screen) — warm paper, hard ink, one electric-chartreuse accent, race-bib metaphor.
- **Night Ops** (admin dashboard, registrations table, drawer, add-entry, event config, reports) — near-black "timing board," same chartreuse used as telemetry.

This does NOT change any backend logic, Supabase schema, validation rules, or business rules — only the visual layer and a few UX behaviors (blur-based validation, a themed date picker, functional table filters). All copy, categories, fees, and flows come from the existing app (`src/features/register`, `src/features/admin`).

## About the design files
The five `.dc.html` files in this bundle are **design references built as interactive HTML prototypes** — not production code to copy verbatim. They exist to show exact colors, type, spacing, motion, and state behavior. Your task is to **recreate this design inside the existing React + Vite + Tailwind + shadcn/ui + Supabase codebase**, using its existing component structure, hooks, and data flow — porting the *visuals and interaction patterns* shown here, not the HTML/inline-style markup itself.

## Fidelity
**High-fidelity.** Treat every hex value, font, spacing figure, and animation timing below (and in `Design Spec — Start Line.dc.html`) as final. Where the prototype's copy differs from live data (e.g. mock registrant names, mock revenue numbers), use real data — only the visual treatment is authoritative.

## Files in this bundle
- `Design Spec — Start Line.dc.html` — **start here.** Full token list (drop-in CSS custom properties for `:root` / `.dark`), typography system, component-by-component pattern notes mapped to existing shadcn files (`button.tsx`, `input.tsx`, `badge.tsx`, `sheet.tsx`, `table.tsx`...), animation timing table, loading/empty state specs, and an accessibility ledger (contrast ratios, touch targets, keyboard/focus behavior).
- `Register — Start Line.dc.html` — the full 4-step public wizard (Eligibility → Personal → Payment → Review) + Success screen, interactive. Toggle `screen` prop (Tweaks panel) to see `loading` / `closed` states.
- `Admin — Night Ops.dc.html` — Dashboard, Registrations table + detail drawer, Add Entry (manual registration), Event Config, Reports — all interactive/clickable. Toggle `dataState` prop to see `loading` / `empty` states.
- `Baseline — Public.dc.html` / `Baseline — Admin.dc.html` — static recreations of the **current shipped UI**, for side-by-side comparison only. Do not implement these — they document the "before."

## Screens / Views

### 1. Public registration wizard (`Register — Start Line.dc.html`)
**Purpose:** collect eligibility, personal info, payment proof, and consent across 4 steps; auto-derive category+fee from gender/DOB.
**Layout:** Two-column shell, `max-width: 1060px`, centered, `min-height: 100vh`. Left rail (`flex: 1 1 280px`, `max-width: 400px`) is a fixed dark-ink identity panel (logo linking to triathlonbangladesh.com, event name, 10K/40K/5K stat strip, date/venue/fee, slots-claimed bar). Right column (`flex: 999 1 340px`) holds the route-progress SVG, the step card, and nav buttons, vertically centered on tall viewports. Below 700px combined width the two columns wrap (rail on top, form below) — this is the primary mobile layout at 360–414px.
- **Route progress** — a single SVG line standing in for the race course. Segment boundaries are proportional to real distances: RUN 10K (0–29%), BIKE 40K (29%–72%... i.e. dot at x118/398), RUN 5K, FINISH gantry glyph at the end. Filled portion = ink (`#15180E`), the traveling position dot is chartreuse with a 1.6s pulse. ViewBox `-8 0 416 36` (padded so the r=5.5 leading dot and end text never clip). Transition: `all .45s cubic-bezier(.65,0,.35,1)`.
- **Step card**: `#FBFAF5` bg, `1.5px solid #15180E` border, hard shadow `7px 7px 0 rgba(21,24,14,.9)`, ghost step-number watermark top-right (`Oswald 700 92px`, ink at 6% opacity). Slides in on step change: `sl-step-fwd`/`sl-step-back`, `26ms ease-out`, 28px horizontal travel.
- **Step 1 — Eligibility**: Gender as 2 large tap-tiles (not radios); Date of birth as a text input (`dd/mm/yyyy`, `IBM Plex Mono`) **plus** a calendar-icon button that opens a themed popover date picker (month/year `<select>`s + a day grid, ink/chartreuse palette, disables future dates). Category + fee auto-resolve and appear in a chartreuse result card the instant gender+valid DOB are present.
- **Step 2 — Personal**: full name (English), phone, emergency phone, email, blood group (8-tile grid), address (textarea), jersey size (7-tile grid) with a collapsible size chart table and a persistent caution note ("pro jerseys fit true to chart, not loose like regular T-shirts").
- **Step 3 — Payment**: a dark "send money to" instruction ticket with the payment number and live fee; **4** payment method tiles — bKash, Nagad, Rocket, Upay (grid `repeat(auto-fit, minmax(120px,1fr))` so it reflows 2×2 on narrow screens); sender number; transaction ID (auto-uppercased); optional comments.
- **Step 4 — Review**: renders the same "bib" component as the success screen, stamped `DRAFT`, listing every entered field; a large tap-target consent checkbox row (not a tiny checkbox) with the required fitness/rules attestation text (bilingual).
- **Nav**: Back (outline) + Next/Submit (solid ink→chartreuse on submit) buttons, `56px` tall, disabled state removes the shadow and dims text/bg — buttons are real `<button disabled>`, not just visually greyed.

**Validation behavior (important UX change from current app):** errors show **on blur, not on every keystroke.** Track a `touched` map; only compute/display a field's error once that field has been blurred. This applies to DOB, name, phone, emergency phone, email, sender number, and transaction ID on the public wizard, and equivalently to the Add Entry form in admin.

### 2. Success screen
**Purpose:** the registrant's only receipt (no email/SMS sent) — must feel earned, screenshottable.
Renders as a **race bib**: chartreuse header strip (event name + date), two punch-holes at the top corners, the reference code in `Oswald 600 52px` centered over a dashed tear line with a "Copy code" button (copies to clipboard, flips to a filled "✓ Copied" state for 2s), an athlete-details grid, and a footer with the pending-verification message plus a **hand-rotated "PENDING" rubber-stamp** (`2.5px solid #B77E10`, `rotate(-4deg)`, stamps in at 1.5s after the border finishes drawing). The card's border draws itself via an SVG `pathLength`/`stroke-dashoffset` animation (1.2s, starts at 0.5s) — this is the successor to the old gold-ring animation; keep that "the receipt draws itself" spirit even if the implementation differs.

### 3. Admin dashboard (`Admin — Night Ops.dc.html`, Dashboard tab)
Dark (`#0B0D08`) "timing board." Top row: slots-claimed card (140/250, mini 25-segment bar) + 4 status tiles (pending/approved/rejected/cancelled) each with a 2px top rule in its status color and a one-line hint ("oldest 3 days ago", "+12 this week"). Second row: verified revenue, pending revenue, and a cumulative registrations line chart (SVG, chartreuse line + soft fill). Third row: by-category breakdown with mini progress bars, a category × jersey-size heat-mapped matrix (darker chartreuse tint = higher count) for the T-shirt order, and a recent-activity feed (timestamp + action + colored meta line).

### 4. Registrations table + drawer (`Admin — Night Ops.dc.html`, Registrations tab)
Toolbar: search input (name/phone/TxID/ref), a status segmented control (chartreuse = active), and **3 functional `<select>` dropdown filters** (category, jersey size, role) — implement as real controlled selects, not display-only chips. Table: dense rows (44px), ref codes in chartreuse mono, pending rows carry a 2px amber left-rule for at-a-glance scanning, status chips are bordered+tinted (not filled) squares. Row click opens a right-side detail drawer (`min(460px,100vw)`, slide-in 220ms) grouped into Athlete / Race / Payment sections, an admin note textarea, and a 2×2 status-change button grid; choosing "rejected" or "cancelled" opens a confirm dialog (red top rule) before applying.

### 5. Add Entry (`Admin — Night Ops.dc.html`, Add Entry tab)
Manual registration form for organizers/crew/offline payments — bypasses capacity + duplicate guards. Three grouped sections (Athlete / Classification / Payment) with real inputs and selects; Category is auto-derived read-only text (same age/gender logic as the public wizard); submit is disabled until name, valid phone, gender, valid DOB, and jersey size are present, then prepends a new row to the table and shows a one-line success confirmation banner.

### 6. Event Config & Reports
Event Config: gate settings (registration open toggle, deadline, max slots, payment number, fee note) + an editable categories table (name/gender/age band/fee/slots/claimed + edit/delete). Reports: 3 export cards (Jersey Report, Timing Partner Export, General Export) each with an optional filter dropdown and a bordered chartreuse "Download Excel" button — visual only, wire to the existing xlsx export logic.

## Design tokens
See `Design Spec — Start Line.dc.html` §1 for the full copy-pasteable `:root`/`.dark` block. Headline values:
- Public background `#F1EFE6`, card `#FBFAF5`, ink `#15180E`, accent `#C6F53F` (chartreuse — never long-form text on paper; use `#5A7A00` for chartreuse-as-text), warn `#B77E10`, error `#C7361F`.
- Admin background `#0B0D08`, card `#14170F`, border `#262B1B`/`#363D28`, muted text `#9BA18A`, faint `#7C8272`, same chartreuse accent, status colors pending `#E8B931` / approved `#C6F53F` / rejected `#E24E3B` / cancelled `#7C8272`.
- Fonts: **Oswald** 600/700 uppercase for all display/section-label type; **Inter** for body; **Noto Sans Bengali** for Bengali helper/error text (inline, not a separate block); **IBM Plex Mono** for every number a user compares (ref codes, fees, phones, TxIDs) — set `tabular-nums`. `--radius: 0` throughout; corners are cut, not rounded.

## Interactions & animation notes
Full timing table in Design Spec §4. Highlights: step transitions (`sl-step-fwd`/`back`, 260ms), route-progress fill (450ms cubic-bezier), success-bib border draw (1.2s, delayed 0.5s) + pending stamp (450ms, delayed 1.5s), field-invalid shake (220ms, one-shot), and the only two *infinite* animations in the whole system: the admin skeleton shimmer and the loading dashed-line march — everything else plays once and stops. All animation is plain CSS, gated behind `prefers-reduced-motion: reduce` (collapse to ~0ms).

## Loading & empty states
Full spec in Design Spec §5, and both are live-toggleable in the prototypes via their Tweaks panel (`screen` on the wizard; `dataState` on admin). Public wizard: a marching dashed chartreuse line stands in for a spinner everywhere (no circular spinners in this system). Admin dashboard/table: shimmer skeletons shaped like the final layout, distinguishing "no data at all" (dashed panel + share-link CTA) from "no rows match current filters" (message + Clear Filters button).

## Accessibility
Contrast ratios, touch-target minimums, keyboard/focus behavior, and reduced-motion handling are itemized in Design Spec §6 — read it before implementing forms and the drawer (focus trap + Esc-to-close + roving-tabindex tile groups).

## Assets
- `poster.jpg`, `triathlon-bd-shield-white.png` — copied from the existing repo's `public/assets/`; reuse as-is.
- All icons are inline SVG (calendar, chevron, search, checkmark) — no icon font/library dependency introduced.

## Known prototype gaps (flag to the design owner, don't silently invent)
- Payment number shown is a placeholder (`01700-000000`) — confirm the real number before shipping.
- Jersey chest/length measurements are provisional pending the real spec sheet.
- Event Config and Reports pages are visual-only in the prototype (no live wiring) — implement against your existing config/export logic.
