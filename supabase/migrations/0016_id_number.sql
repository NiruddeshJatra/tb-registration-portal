-- 0016_id_number.sql
-- Mirsharai Coastal Marathon 2027: drop the veteran NID/passport PHOTO upload
-- and instead require every registrant to type their NID or birth registration
-- number.
--
-- 1. events.requires_id_number  — new flag, on for Mirsharai only.
-- 2. registrations.id_number    — digits only, 10-17 (chk_id_number).
-- 3. Mirsharai: id_doc_min_age -> null, which switches the photo requirement
--    off in both RPCs and hides the picker. The photo already uploaded stays in
--    the bucket and in id_document_path; the admin drawer still opens it.
-- 4. Both RPCs gain p_id_number. Adding a parameter makes a new overload, so
--    the old signatures are dropped explicitly, and the admin one gets the
--    public/anon EXECUTE revoke again (see 0013).
--
-- Rows registered before this have id_number = null; only new public sign-ups
-- are forced. Apply BEFORE pushing the matching frontend.
--
-- Idempotent: safe to re-run.

alter table events add column if not exists requires_id_number boolean not null default false;
alter table registrations add column if not exists id_number text;

alter table registrations drop constraint if exists chk_id_number;
alter table registrations add constraint chk_id_number
  check (id_number is null or id_number ~ '^[0-9]{10,17}$');

update events
   set requires_id_number = true,
       id_doc_min_age = null
 where slug = 'mirsharai-coastal-marathon-2027';

-- ============================================================================
-- register_participant()
-- ============================================================================
drop function if exists register_participant(
  text, text, text, text, text, date, text, text, text, text, text, text, text, text, text,
  text, text, uuid, text, text, text
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
  p_category_id uuid default null,
  p_transport_mode text default null,
  p_shuttle_point text default null,
  p_id_document_path text default null,
  p_id_number text default null
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
  v_transport_mode text;
  v_shuttle_point text;
  v_id_document_path text;
  v_id_number text;
  v_count int;
  v_total_count int;
  v_ref_code text;
  v_counter int;
  v_constraint text;
begin
  -- 1. event checks. An archived event does not exist as far as the public
  --    is concerned.
  select * into v_event from events where slug = p_event_slug;
  if not found or v_event.is_archived then
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
  -- per-category guard below, so a total slot cap can't be oversold either.
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

  -- transport: required on events that run a shuttle, discarded elsewhere.
  -- A shuttle rider must name one of the event's own pickup points.
  v_transport_mode := nullif(trim(coalesce(p_transport_mode, '')), '');
  v_shuttle_point := nullif(trim(coalesce(p_shuttle_point, '')), '');
  if v_event.offers_shuttle then
    if v_transport_mode is null or v_transport_mode not in ('private_car', 'shuttle_bus') then
      return jsonb_build_object('ok', false, 'error', 'transport_required');
    end if;
    if v_transport_mode = 'shuttle_bus' then
      if v_shuttle_point is null or not exists (
        select 1 from jsonb_array_elements(v_event.shuttle_points) p where p->>'en' = v_shuttle_point
      ) then
        return jsonb_build_object('ok', false, 'error', 'shuttle_point_required');
      end if;
    else
      v_shuttle_point := null;
    end if;
  else
    v_transport_mode := null;
    v_shuttle_point := null;
  end if;

  -- NID / birth registration number: spaces and dashes dropped, then 10-17
  -- digits (10/13/17-digit NID, 17-digit birth certificate). Mandatory where
  -- the event asks for it, discarded elsewhere.
  v_id_number := nullif(regexp_replace(coalesce(p_id_number, ''), '[\s-]', '', 'g'), '');
  if v_event.requires_id_number then
    if v_id_number is null then
      return jsonb_build_object('ok', false, 'error', 'id_number_required');
    end if;
    if v_id_number !~ '^[0-9]{10,17}$' then
      return jsonb_build_object('ok', false, 'error', 'bad_id_number');
    end if;
  else
    v_id_number := null;
  end if;

  -- Age on race day drives the auto-match, the age band of a picked category,
  -- and the ID-photo requirement.
  v_age := extract(year from age(v_event.event_date, p_date_of_birth))::int;

  -- ID photo: mandatory from id_doc_min_age upwards, discarded below it. The
  -- path must sit under this event's folder and the object must really exist —
  -- a client-only check is no check, the RPC is the only public write path.
  v_id_document_path := nullif(trim(coalesce(p_id_document_path, '')), '');
  if v_event.id_doc_min_age is not null and v_age >= v_event.id_doc_min_age then
    if v_id_document_path is null
       or left(v_id_document_path, length(v_event.slug) + 1) <> v_event.slug || '/'
       or not exists (
         select 1 from storage.objects
          where bucket_id = 'id-documents' and name = v_id_document_path
       ) then
      return jsonb_build_object('ok', false, 'error', 'id_document_required');
    end if;
  else
    v_id_document_path := null;
  end if;

  -- 2. category resolution.
  --    manual_category_select events resolve from the athlete's own pick. The
  --    id must belong to this event, match the gender AND cover the athlete's
  --    age — the age band is what stops someone picking the Veteran row (or
  --    the General row) of a distance they are not entitled to. Rows without
  --    age bands (min_age 0 / max_age null) are unaffected.
  --    Everywhere else the age/gender auto-match is the ONLY path: honouring a
  --    caller-supplied id there would let a public caller pick their own age
  --    bracket or fee, so a supplied id is rejected outright.
  if v_event.manual_category_select then
    if p_category_id is null then
      return jsonb_build_object('ok', false, 'error', 'no_category');
    end if;
    select * into v_category
      from categories
     where id = p_category_id
       and event_id = v_event.id
       and gender = p_gender
       and min_age <= v_age
       and (max_age is null or v_age <= max_age);
    if not found then
      return jsonb_build_object('ok', false, 'error', 'no_category');
    end if;
  else
    if p_category_id is not null then
      return jsonb_build_object('ok', false, 'error', 'no_category');
    end if;
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
  -- concurrent registrations into the same category for the life of this
  -- transaction (the event lock above already serializes the whole event).
  -- Rows sharing a group_label share ONE cap: max_slots on a "42.2K" row is
  -- the limit for the whole distance, counted across its General/Veteran and
  -- male/female rows — not a per-row allowance.
  perform pg_advisory_xact_lock(hashtextextended(v_category.id::text, 0));
  if v_category.max_slots is not null then
    select count(*) into v_count
      from registrations r
      join categories c on c.id = r.category_id
     where c.event_id = v_event.id
       and (c.id = v_category.id
            or (v_category.group_label is not null and c.group_label = v_category.group_label))
       and r.status not in ('rejected', 'cancelled');
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
      participant_role, entry_source, bike_type, strava_link,
      transport_mode, shuttle_point, id_document_path, id_number
    ) values (
      v_ref_code, v_event.id, v_category.id, v_full_name, v_phone, p_email, p_gender, p_date_of_birth,
      p_blood_group, p_jersey_size, p_address, v_emergency_phone, p_comments,
      p_payment_method, p_payment_sender, v_transaction_id, now(),
      coalesce(p_participant_role, 'runner'), 'self', v_bike_type, v_strava_link,
      v_transport_mode, v_shuttle_point, v_id_document_path, v_id_number
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
  text, text, uuid, text, text, text, text
) to anon, authenticated;

-- ============================================================================
-- admin_register_participant()
-- ============================================================================
drop function if exists admin_register_participant(
  uuid, uuid, text, text, text, text, date, text, text, text, text, text,
  text, text, text, text, text, text, text, text, text, text, int, text, text,
  text, text, text
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
  p_strava_link text default null,
  p_transport_mode text default null,
  p_shuttle_point text default null,
  p_id_document_path text default null,
  p_id_number text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event events%rowtype;
  v_age int;
  v_phone text;
  v_emergency_phone text;
  v_full_name text;
  v_transaction_id text;
  v_bike_type text;
  v_strava_link text;
  v_transport_mode text;
  v_shuttle_point text;
  v_id_document_path text;
  v_id_number text;
  v_ref_code text;
  v_counter int;
  v_constraint text;
begin
  -- Being signed in is not enough: the caller must be on the admins allowlist.
  if not is_admin() then
    return jsonb_build_object('ok', false, 'error', 'not_authorized');
  end if;

  -- An archived event takes no new entries from anyone.
  select * into v_event from events where id = p_event_id;
  if not found or v_event.is_archived then
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

  -- transport: optional for admins, but a value that is given must be valid.
  v_transport_mode := nullif(trim(coalesce(p_transport_mode, '')), '');
  v_shuttle_point := nullif(trim(coalesce(p_shuttle_point, '')), '');
  if v_transport_mode is not null and v_transport_mode not in ('private_car', 'shuttle_bus') then
    return jsonb_build_object('ok', false, 'error', 'transport_required');
  end if;
  if v_transport_mode = 'shuttle_bus' then
    if v_shuttle_point is null or not exists (
      select 1 from jsonb_array_elements(v_event.shuttle_points) p where p->>'en' = v_shuttle_point
    ) then
      return jsonb_build_object('ok', false, 'error', 'shuttle_point_required');
    end if;
  else
    v_shuttle_point := null;
  end if;

  -- ID photo: same rule as the public form for anyone placed in a category.
  v_age := extract(year from age(v_event.event_date, p_date_of_birth))::int;
  v_id_document_path := nullif(trim(coalesce(p_id_document_path, '')), '');
  if v_id_document_path is not null and not exists (
    select 1 from storage.objects
     where bucket_id = 'id-documents' and name = v_id_document_path
  ) then
    return jsonb_build_object('ok', false, 'error', 'id_document_required');
  end if;
  if v_event.id_doc_min_age is not null
     and p_category_id is not null
     and v_age >= v_event.id_doc_min_age
     and v_id_document_path is null then
    return jsonb_build_object('ok', false, 'error', 'id_document_required');
  end if;

  -- NID / birth registration number: optional for admins (legacy rows, crew),
  -- but a value that is given must be valid.
  v_id_number := nullif(regexp_replace(coalesce(p_id_number, ''), '[\s-]', '', 'g'), '');
  if v_id_number is not null and v_id_number !~ '^[0-9]{10,17}$' then
    return jsonb_build_object('ok', false, 'error', 'bad_id_number');
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
      complimentary_reason, authorized_by, group_name, bike_type, strava_link,
      transport_mode, shuttle_point, id_document_path, id_number
    ) values (
      v_ref_code, v_event.id, p_category_id, v_full_name, v_phone, p_email, p_gender, p_date_of_birth,
      p_blood_group, p_jersey_size, p_address, v_emergency_phone, p_comments,
      p_payment_method, p_payment_sender, v_transaction_id, p_amount_paid, now(),
      p_participant_role, p_entry_source, p_registration_type, p_discount_reason,
      p_complimentary_reason, p_authorized_by, p_group_name, v_bike_type, v_strava_link,
      v_transport_mode, v_shuttle_point, v_id_document_path, v_id_number
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

revoke execute on function admin_register_participant(
  uuid, uuid, text, text, text, text, date, text, text, text, text, text,
  text, text, text, text, text, text, text, text, text, text, int, text, text,
  text, text, text, text
) from public, anon;
grant execute on function admin_register_participant(
  uuid, uuid, text, text, text, text, date, text, text, text, text, text,
  text, text, text, text, text, text, text, text, text, text, int, text, text,
  text, text, text, text
) to authenticated;
