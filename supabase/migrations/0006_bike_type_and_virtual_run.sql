-- 0006_bike_type_and_virtual_run.sql
-- 1. Bike type question for the Chattogram Duathlon 2026 form.
-- 2. New event: Chatto Metro Virtual Run 2026 — distance-based self-select
--    categories (5K/10K/21K) + optional Strava proof link.
--
-- Idempotent: safe to re-run. Additive only — the existing duathlon
-- registrations keep NULLs in every new column, no backfill, no NOT NULLs.
--
-- Also moves the duathlon race date to 6 November 2026 (section 5).
--
-- PLACEHOLDERS (see the seed block at the bottom): event name, short_code,
-- payment_number, fee_note and the category fees are provisional.

-- ============================================================================
-- 1. EVENTS: per-event feature flags
-- ============================================================================
alter table events add column if not exists requires_bike_type boolean not null default false;
alter table events add column if not exists collects_strava_link boolean not null default false;
alter table events add column if not exists manual_category_select boolean not null default false;

-- ============================================================================
-- 2. REGISTRATIONS: two new optional columns
-- ============================================================================
alter table registrations add column if not exists bike_type text;
alter table registrations add column if not exists strava_link text;

alter table registrations drop constraint if exists chk_bike_type;
alter table registrations add constraint chk_bike_type
  check (bike_type is null or bike_type in ('MTB', 'Road/TT'));

alter table registrations drop constraint if exists chk_strava_link;
alter table registrations add constraint chk_strava_link
  check (strava_link is null or strava_link ~* '^https?://');

-- ============================================================================
-- 3. register_participant()
-- ============================================================================
-- Postgres identifies a function by name + input argument types, so
-- CREATE OR REPLACE with new trailing params would create a SECOND overload
-- and leave the old 15-arg one live (this bit us on admin_register_participant
-- in 0003). Drop the exact old signature first. Grants do not survive the
-- drop — they are re-issued at the bottom of this block.
drop function if exists register_participant(
  text, text, text, text, text, date, text, text, text, text, text, text, text, text, text
);

create or replace function register_participant(
  p_event_slug text,
  p_full_name text,
  p_phone text,
  p_email text,
  p_gender text,
  p_date_of_birth date,
  p_blood_group text,
  p_jersey_size text,
  p_address text,
  p_emergency_phone text,
  p_comments text,
  p_payment_method text,
  p_payment_sender text,
  p_transaction_id text,
  p_participant_role text default 'runner',
  p_bike_type text default null,
  p_strava_link text default null,
  p_category_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event events%rowtype;
  v_category categories%rowtype;
  v_age int;
  v_phone text;
  v_emergency_phone text;
  v_full_name text;
  v_transaction_id text;
  v_bike_type text;
  v_strava_link text;
  v_count int;
  v_total_count int;
  v_ref_code text;
  v_counter int;
  v_constraint text;
begin
  -- 1. event checks
  select * into v_event from events where slug = p_event_slug;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'event_not_found');
  end if;
  if not v_event.registration_open then
    return jsonb_build_object('ok', false, 'error', 'registration_closed');
  end if;
  if v_event.registration_deadline is not null and current_date > v_event.registration_deadline then
    return jsonb_build_object('ok', false, 'error', 'deadline_passed');
  end if;

  -- event-wide capacity guard (atomic): advisory lock keyed on the event id
  -- serializes concurrent registrations for this event, same technique as the
  -- per-category guard below, so a total slot cap (e.g. 250 for Chattogram
  -- Duathlon 2026) can't be oversold either.
  perform pg_advisory_xact_lock(hashtextextended(v_event.id::text, 1));
  if v_event.max_total_slots is not null then
    select count(*) into v_total_count
      from registrations
     where event_id = v_event.id
       and status not in ('rejected', 'cancelled');
    if v_total_count >= v_event.max_total_slots then
      return jsonb_build_object('ok', false, 'error', 'event_full');
    end if;
  end if;

  -- 4. normalize phones (done before category match so bad input fails fast)
  v_phone := regexp_replace(p_phone, '[^0-9]', '', 'g');
  if left(v_phone, 3) = '880' then
    v_phone := substring(v_phone from 3);
  end if;
  if v_phone !~ '^01[3-9][0-9]{8}$' then
    return jsonb_build_object('ok', false, 'error', 'bad_phone');
  end if;

  v_emergency_phone := regexp_replace(p_emergency_phone, '[^0-9]', '', 'g');
  if left(v_emergency_phone, 3) = '880' then
    v_emergency_phone := substring(v_emergency_phone from 3);
  end if;
  if v_emergency_phone !~ '^01[3-9][0-9]{8}$' then
    return jsonb_build_object('ok', false, 'error', 'bad_phone');
  end if;

  if v_phone = v_emergency_phone then
    return jsonb_build_object('ok', false, 'error', 'same_phone');
  end if;

  if p_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' then
    return jsonb_build_object('ok', false, 'error', 'bad_email');
  end if;

  -- normalize full name to Title Case, folding any Md/MD/Md./MD. token to 'Md.'
  v_full_name := initcap(trim(regexp_replace(p_full_name, '\s+', ' ', 'g')));
  v_full_name := regexp_replace(v_full_name, '\yMd\.?\y', 'Md.', 'gi');
  if v_full_name !~ '^[A-Za-z][A-Za-z .''-]{1,79}$' then
    return jsonb_build_object('ok', false, 'error', 'bad_name');
  end if;

  v_transaction_id := upper(trim(p_transaction_id));
  if v_transaction_id !~ '^[A-Z0-9]{8,15}$' then
    return jsonb_build_object('ok', false, 'error', 'bad_txid');
  end if;

  -- bike type / strava link: both optional. Blank folds to NULL; a non-blank
  -- value is validated here so the failure surfaces as a RegisterParticipantError
  -- code rather than a raw CHECK-constraint exception.
  v_bike_type := nullif(trim(coalesce(p_bike_type, '')), '');
  if v_bike_type is not null and v_bike_type not in ('MTB', 'Road/TT') then
    return jsonb_build_object('ok', false, 'error', 'bad_bike_type');
  end if;

  v_strava_link := nullif(trim(coalesce(p_strava_link, '')), '');
  if v_strava_link is not null and v_strava_link !~* '^https?://' then
    return jsonb_build_object('ok', false, 'error', 'bad_strava_link');
  end if;

  -- 2. category resolution.
  --    p_category_id NULL  -> legacy auto-match by gender + age (duathlon path,
  --                           behaviour unchanged).
  --    p_category_id given -> self-select events (manual_category_select), where
  --                           several categories share the same gender/age range
  --                           and auto-match would always pick the first one.
  --                           The id is still verified to belong to this event
  --                           and to match the submitted gender.
  if p_category_id is not null then
    select * into v_category
      from categories
     where id = p_category_id
       and event_id = v_event.id
       and gender = p_gender;
    if not found then
      return jsonb_build_object('ok', false, 'error', 'no_category');
    end if;
  else
    v_age := extract(year from age(v_event.event_date, p_date_of_birth))::int;
    select * into v_category
      from categories
     where event_id = v_event.id
       and gender = p_gender
       and min_age <= v_age
       and (max_age is null or v_age <= max_age)
     order by display_order
     limit 1;
    if not found then
      return jsonb_build_object('ok', false, 'error', 'no_category');
    end if;
  end if;

  -- 3. capacity guard (atomic): advisory lock keyed on category id serializes
  -- concurrent registrations into the same category for the life of this transaction.
  perform pg_advisory_xact_lock(hashtextextended(v_category.id::text, 0));
  if v_category.max_slots is not null then
    select count(*) into v_count
      from registrations
     where category_id = v_category.id
       and status not in ('rejected', 'cancelled');
    if v_count >= v_category.max_slots then
      return jsonb_build_object('ok', false, 'error', 'category_full');
    end if;
  end if;

  -- 5. ref_code: atomically incremented per-event counter
  update events set reg_counter = reg_counter + 1 where id = v_event.id returning reg_counter into v_counter;
  v_ref_code := v_event.short_code || '-' || lpad(v_counter::text, 6, '0');

  -- 6/7. insert, translating unique violations into friendly error codes
  begin
    insert into registrations (
      ref_code, event_id, category_id, full_name, phone, email, gender, date_of_birth,
      blood_group, jersey_size, address, emergency_phone, comments,
      payment_method, payment_sender, transaction_id, consent_given_at,
      participant_role, entry_source, bike_type, strava_link
    ) values (
      v_ref_code, v_event.id, v_category.id, v_full_name, v_phone, p_email, p_gender, p_date_of_birth,
      p_blood_group, p_jersey_size, p_address, v_emergency_phone, p_comments,
      p_payment_method, p_payment_sender, v_transaction_id, now(),
      coalesce(p_participant_role, 'runner'), 'self', v_bike_type, v_strava_link
    );
  exception
    when unique_violation then
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint = 'registrations_event_txid_key' then
        return jsonb_build_object('ok', false, 'error', 'dup_txid');
      elsif v_constraint = 'registrations_event_phone_self_key' then
        return jsonb_build_object('ok', false, 'error', 'dup_phone');
      else
        raise;
      end if;
  end;

  return jsonb_build_object(
    'ok', true,
    'ref_code', v_ref_code,
    'category_name', v_category.name,
    'fee', v_category.fee,
    'status', 'pending'
  );
end;
$$;

grant execute on function register_participant(
  text, text, text, text, text, date, text, text, text, text, text, text, text, text, text,
  text, text, uuid
) to anon, authenticated;

-- ============================================================================
-- 4. admin_register_participant()
-- ============================================================================
-- Same drop-then-create dance, against the exact 23-arg signature from 0003.
drop function if exists admin_register_participant(
  uuid, uuid, text, text, text, text, date, text, text, text, text, text,
  text, text, text, text, text, text, text, text, text, text, int
);

create or replace function admin_register_participant(
  p_event_id uuid,
  p_category_id uuid,
  p_full_name text,
  p_phone text,
  p_email text,
  p_gender text,
  p_date_of_birth date,
  p_blood_group text,
  p_jersey_size text,
  p_address text,
  p_emergency_phone text,
  p_comments text,
  p_payment_method text,
  p_payment_sender text,
  p_transaction_id text,
  p_participant_role text,
  p_entry_source text,
  p_registration_type text,
  p_discount_reason text,
  p_complimentary_reason text,
  p_authorized_by text,
  p_group_name text,
  p_amount_paid int default null,
  p_bike_type text default null,
  p_strava_link text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event events%rowtype;
  v_phone text;
  v_emergency_phone text;
  v_full_name text;
  v_transaction_id text;
  v_bike_type text;
  v_strava_link text;
  v_ref_code text;
  v_counter int;
  v_constraint text;
begin
  select * into v_event from events where id = p_event_id;
  if not found then
    return jsonb_build_object('ok', false, 'error', 'event_not_found');
  end if;

  v_phone := regexp_replace(p_phone, '[^0-9]', '', 'g');
  if left(v_phone, 3) = '880' then
    v_phone := substring(v_phone from 3);
  end if;

  v_emergency_phone := regexp_replace(p_emergency_phone, '[^0-9]', '', 'g');
  if left(v_emergency_phone, 3) = '880' then
    v_emergency_phone := substring(v_emergency_phone from 3);
  end if;

  if v_phone = v_emergency_phone then
    return jsonb_build_object('ok', false, 'error', 'same_phone');
  end if;

  if p_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' then
    return jsonb_build_object('ok', false, 'error', 'bad_email');
  end if;

  v_full_name := initcap(trim(regexp_replace(p_full_name, '\s+', ' ', 'g')));
  v_full_name := regexp_replace(v_full_name, '\yMd\.?\y', 'Md.', 'gi');
  if v_full_name !~ '^[A-Za-z][A-Za-z .''-]{1,79}$' then
    return jsonb_build_object('ok', false, 'error', 'bad_name');
  end if;

  -- transaction id: optional only for complimentary entries left blank; validated otherwise
  if p_transaction_id is null or trim(p_transaction_id) = '' then
    v_transaction_id := null;
    if p_registration_type <> 'complimentary' then
      return jsonb_build_object('ok', false, 'error', 'bad_txid');
    end if;
  else
    v_transaction_id := upper(trim(p_transaction_id));
    if v_transaction_id !~ '^[A-Z0-9]{8,15}$' then
      return jsonb_build_object('ok', false, 'error', 'bad_txid');
    end if;
  end if;

  v_bike_type := nullif(trim(coalesce(p_bike_type, '')), '');
  if v_bike_type is not null and v_bike_type not in ('MTB', 'Road/TT') then
    return jsonb_build_object('ok', false, 'error', 'bad_bike_type');
  end if;

  v_strava_link := nullif(trim(coalesce(p_strava_link, '')), '');
  if v_strava_link is not null and v_strava_link !~* '^https?://' then
    return jsonb_build_object('ok', false, 'error', 'bad_strava_link');
  end if;

  -- Friendly duplicate-phone guard for single manual adds. Group imports
  -- (entry_source = 'group_import') may legitimately share a contact phone.
  if p_entry_source is distinct from 'group_import' then
    if exists (
      select 1 from registrations
       where event_id = p_event_id
         and phone = v_phone
         and entry_source is distinct from 'group_import'
    ) then
      return jsonb_build_object('ok', false, 'error', 'dup_phone');
    end if;
  end if;

  update events set reg_counter = reg_counter + 1 where id = v_event.id returning reg_counter into v_counter;
  v_ref_code := v_event.short_code || '-' || lpad(v_counter::text, 6, '0');

  begin
    insert into registrations (
      ref_code, event_id, category_id, full_name, phone, email, gender, date_of_birth,
      blood_group, jersey_size, address, emergency_phone, comments,
      payment_method, payment_sender, transaction_id, amount_paid, consent_given_at,
      participant_role, entry_source, registration_type, discount_reason,
      complimentary_reason, authorized_by, group_name, bike_type, strava_link
    ) values (
      v_ref_code, v_event.id, p_category_id, v_full_name, v_phone, p_email, p_gender, p_date_of_birth,
      p_blood_group, p_jersey_size, p_address, v_emergency_phone, p_comments,
      p_payment_method, p_payment_sender, v_transaction_id, p_amount_paid, now(),
      p_participant_role, p_entry_source, p_registration_type, p_discount_reason,
      p_complimentary_reason, p_authorized_by, p_group_name, v_bike_type, v_strava_link
    );
  exception
    when unique_violation then
      get stacked diagnostics v_constraint = constraint_name;
      if v_constraint = 'registrations_event_txid_key' then
        return jsonb_build_object('ok', false, 'error', 'dup_txid');
      else
        raise;
      end if;
  end;

  return jsonb_build_object('ok', true, 'ref_code', v_ref_code);
end;
$$;

grant execute on function admin_register_participant(
  uuid, uuid, text, text, text, text, date, text, text, text, text, text,
  text, text, text, text, text, text, text, text, text, text, int, text, text
) to authenticated;

-- ============================================================================
-- 5. Chattogram Duathlon 2026: turn the bike-type question on and move the
--    race date to 6 November 2026 (was 13 November). Bike check-in is the day
--    before, 5 November — that line is copy in the registration rail, not a
--    column. Existing registrations are untouched: event_date only feeds the
--    age calculation for auto-matched categories, and the age brackets here
--    (18-39 / 40+) are unaffected by a one-week shift.
-- ============================================================================
update events
   set requires_bike_type = true,
       event_date = '2026-11-06'
 where slug = 'chattogram-duathlon-2026';

-- ============================================================================
-- 6. SEED — Chatto Metro Virtual Run 2026
-- ============================================================================
-- !! PLACEHOLDER VALUES — confirm before go-live:
--    name, short_code (ref_code prefix), venue copy, payment_number,
--    fee_note, category fees.
--    registration_open is deliberately FALSE — flip it from Admin - Event
--    config once the fee/payment copy is final.
insert into events (
  name, slug, short_code, event_date, venue, registration_open,
  max_total_slots, payment_number, payment_methods, fee_note, jersey_chart,
  requires_bike_type, collects_strava_link, manual_category_select
)
values (
  'Chatto Metro Virtual Run 2026',          -- CONFIRM
  'chatto-metro-virtual-run-2026',
  'CMVR26',                                 -- CONFIRM (ref_code prefix)
  '2026-08-21',                             -- nominal only: virtual event, no race day
  'Virtual — Run Anywhere',
  false,                                    -- keep closed until the date/copy are real
  null,
  '01785750821',                            -- CONFIRM
  array['bKash', 'Nagad', 'Rocket', 'Upay'],
  null,                                     -- CONFIRM fee_note copy
  '[
    {"size": "XS", "chest": 34, "length": 24},
    {"size": "S", "chest": 36, "length": 25},
    {"size": "M", "chest": 38, "length": 26},
    {"size": "L", "chest": 40, "length": 27},
    {"size": "XL", "chest": 42, "length": 28},
    {"size": "2XL", "chest": 44, "length": 29},
    {"size": "3XL", "chest": 46, "length": 30}
  ]'::jsonb,
  false,
  true,
  true
)
on conflict (slug) do update set
  venue = excluded.venue,
  payment_methods = excluded.payment_methods,
  requires_bike_type = excluded.requires_bike_type,
  collects_strava_link = excluded.collects_strava_link,
  manual_category_select = excluded.manual_category_select;

-- Six category rows: distance x gender. categories.gender is NOT NULL, so each
-- distance is duplicated per gender by design — the wizard dedupes them down to
-- three visible options (5K / 10K / 21K) and resolves the row by gender.
insert into categories (event_id, name, gender, min_age, max_age, fee, max_slots, display_order)
select e.id, c.name, c.gender, c.min_age, c.max_age, c.fee, null, c.display_order
from events e
cross join (values
  -- max_age is null for every row here, so the column would be inferred as text
  -- without an explicit cast on the first one.
  ('5K',  'male',   0, null::int,  800, 1),
  ('5K',  'female', 0, null,  800, 2),
  ('10K', 'male',   0, null,  900, 3),
  ('10K', 'female', 0, null,  900, 4),
  ('21K', 'male',   0, null, 1000, 5),
  ('21K', 'female', 0, null, 1000, 6)
) as c(name, gender, min_age, max_age, fee, display_order)
where e.slug = 'chatto-metro-virtual-run-2026'
  and not exists (
    select 1 from categories cat
     where cat.event_id = e.id and cat.name = c.name and cat.gender = c.gender
  );
