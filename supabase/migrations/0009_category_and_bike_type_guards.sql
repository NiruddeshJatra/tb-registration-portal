-- 0009_category_and_bike_type_guards.sql
-- Two guards on register_participant(), both from code review of 0006.
--
-- 1. SECURITY: 0006 honoured p_category_id on ANY event, so a public caller
--    could pass a duathlon category id and skip the age-based resolution
--    entirely — e.g. registering a 20-year-old into Male Masters (40+), or
--    into whichever category carried the fee they preferred. p_category_id is
--    now only honoured when the event actually asks the athlete to pick
--    (manual_category_select); anywhere else a supplied id is rejected rather
--    than silently ignored, so a mismatched client fails loudly.
--
-- 2. Bike type was accepted as NULL even on events with requires_bike_type,
--    so a caller skipping the tiles stored no bike type at all. Now required
--    on those events, surfaced as the 'bike_type_required' error code.
--
-- Same argument list as 0006, so CREATE OR REPLACE genuinely replaces here —
-- no DROP needed and the existing grants survive untouched.
--
-- Existing registrations are not revalidated: both guards run on insert only.

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

  -- bike type: blank folds to NULL, and is only acceptable on events that
  -- don't ask for one. Validated here so failures surface as a
  -- RegisterParticipantError code rather than a raw CHECK-constraint exception.
  v_bike_type := nullif(trim(coalesce(p_bike_type, '')), '');
  if v_bike_type is not null and v_bike_type not in ('MTB', 'Road/TT') then
    return jsonb_build_object('ok', false, 'error', 'bad_bike_type');
  end if;
  if v_event.requires_bike_type and v_bike_type is null then
    return jsonb_build_object('ok', false, 'error', 'bike_type_required');
  end if;

  -- strava link: optional everywhere, format-checked when present.
  v_strava_link := nullif(trim(coalesce(p_strava_link, '')), '');
  if v_strava_link is not null and v_strava_link !~* '^https?://' then
    return jsonb_build_object('ok', false, 'error', 'bad_strava_link');
  end if;

  -- 2. category resolution.
  --    manual_category_select events resolve from the athlete's own pick,
  --    because their categories share one gender/age range and auto-match
  --    would always return the lowest display_order row. Everywhere else the
  --    age/gender auto-match is the ONLY path: honouring a caller-supplied id
  --    there would let a public caller pick their own age bracket or fee, so
  --    a supplied id is rejected outright rather than quietly ignored.
  if v_event.manual_category_select then
    if p_category_id is null then
      return jsonb_build_object('ok', false, 'error', 'no_category');
    end if;
    select * into v_category
      from categories
     where id = p_category_id
       and event_id = v_event.id
       and gender = p_gender;
    if not found then
      return jsonb_build_object('ok', false, 'error', 'no_category');
    end if;
  else
    if p_category_id is not null then
      return jsonb_build_object('ok', false, 'error', 'no_category');
    end if;
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
