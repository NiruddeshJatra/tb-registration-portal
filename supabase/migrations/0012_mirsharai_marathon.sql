-- 0012_mirsharai_marathon.sql
-- New event: Mirsharai Coastal Marathon 2027 (5 Feb 2027), plus the four
-- per-event features it needs. All of them are flags/columns on `events`, so
-- the duathlon keeps behaving exactly as before.
--
-- 1. is_archived        — hides an event from the public form AND the admin
--                         event selector. Rows are kept. Set on the virtual run.
-- 2. offers_shuttle +   — "private car or shuttle bus?" and, for shuttle
--    shuttle_points       riders, the pickup point. Points are [{en, bn}].
-- 3. id_doc_min_age     — athletes this age or older on race day must upload
--                         an NID/passport photo (veteran podium verification).
--                         Files live in the private `id-documents` bucket.
-- 4. categories.group_label — the tile an athlete picks ("42.2K") when several
--                         category rows (General / Veteran) sit behind it.
--
-- Both RPCs gain three trailing params, so the old signatures are dropped
-- explicitly (CREATE OR REPLACE would leave them alive as overloads) and the
-- grants re-issued. The deployed client calls with named params, so it keeps
-- working against the new signatures.
--
-- Idempotent: safe to re-run.

-- ============================================================================
-- 1. COLUMNS
-- ============================================================================
alter table events add column if not exists is_archived boolean not null default false;
alter table events add column if not exists offers_shuttle boolean not null default false;
alter table events add column if not exists shuttle_points jsonb not null default '[]';
alter table events add column if not exists id_doc_min_age int;

alter table categories add column if not exists group_label text;

alter table registrations add column if not exists transport_mode text;
alter table registrations add column if not exists shuttle_point text;
alter table registrations add column if not exists id_document_path text;

alter table registrations drop constraint if exists chk_transport_mode;
alter table registrations add constraint chk_transport_mode
  check (transport_mode is null or transport_mode in ('private_car', 'shuttle_bus'));

alter table registrations drop constraint if exists chk_shuttle_point;
alter table registrations add constraint chk_shuttle_point
  check (shuttle_point is null or transport_mode = 'shuttle_bus');

-- ============================================================================
-- 2. STORAGE: private bucket for ID photos
-- ============================================================================
-- The public may only INSERT (no read, list, update or delete), so an uploaded
-- ID can never be fetched back by anyone but a signed-in admin. Object names
-- are `<event-slug>/<random uuid>.jpg`, generated client-side.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('id-documents', 'id-documents', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists id_documents_insert on storage.objects;
create policy id_documents_insert on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'id-documents');

drop policy if exists id_documents_auth_select on storage.objects;
create policy id_documents_auth_select on storage.objects
  for select to authenticated
  using (bucket_id = 'id-documents');

drop policy if exists id_documents_auth_delete on storage.objects;
create policy id_documents_auth_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'id-documents');

-- ============================================================================
-- 3. register_participant()
-- ============================================================================
drop function if exists register_participant(
  text, text, text, text, text, date, text, text, text, text, text, text, text, text, text,
  text, text, uuid
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
  p_id_document_path text default null
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
      transport_mode, shuttle_point, id_document_path
    ) values (
      v_ref_code, v_event.id, v_category.id, v_full_name, v_phone, p_email, p_gender, p_date_of_birth,
      p_blood_group, p_jersey_size, p_address, v_emergency_phone, p_comments,
      p_payment_method, p_payment_sender, v_transaction_id, now(),
      coalesce(p_participant_role, 'runner'), 'self', v_bike_type, v_strava_link,
      v_transport_mode, v_shuttle_point, v_id_document_path
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
  text, text, uuid, text, text, text
) to anon, authenticated;

-- ============================================================================
-- 4. admin_register_participant()
-- ============================================================================
-- Admins stay exempt from the capacity/bike-type/transport-required guards
-- (they enter crew and legacy rows), but the ID photo is NOT waived: any entry
-- placed in a category whose athlete is id_doc_min_age or older needs one, the
-- same as on the public form. Category-less (non-runner) entries are exempt.
drop function if exists admin_register_participant(
  uuid, uuid, text, text, text, text, date, text, text, text, text, text,
  text, text, text, text, text, text, text, text, text, text, int, text, text
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
  p_id_document_path text default null
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
      transport_mode, shuttle_point, id_document_path
    ) values (
      v_ref_code, v_event.id, p_category_id, v_full_name, v_phone, p_email, p_gender, p_date_of_birth,
      p_blood_group, p_jersey_size, p_address, v_emergency_phone, p_comments,
      p_payment_method, p_payment_sender, v_transaction_id, p_amount_paid, now(),
      p_participant_role, p_entry_source, p_registration_type, p_discount_reason,
      p_complimentary_reason, p_authorized_by, p_group_name, v_bike_type, v_strava_link,
      v_transport_mode, v_shuttle_point, v_id_document_path
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
  text, text, text, text, text, text, text, text, text, text, int, text, text,
  text, text, text
) to authenticated;

-- ============================================================================
-- 5. Archive the Chatto Metro Virtual Run 2026 (event is over). Its 35
--    registrations stay in the table; only the event is hidden.
-- ============================================================================
update events
   set is_archived = true,
       registration_open = false
 where slug = 'chatto-metro-virtual-run-2026';

-- ============================================================================
-- 6. SEED — Mirsharai Coastal Marathon 2027
-- ============================================================================
-- registration_open is FALSE and there is no deadline: neither date has been
-- announced. Set them from Admin - Event config.
-- Slots: 42.2K 250, 21.1K 350, 10K 400 (shared per distance, see the capacity
-- guard above), 1000 in total.
insert into events (
  name, slug, short_code, event_date, venue, registration_open,
  max_total_slots, payment_number, payment_methods, fee_note, participation_note,
  jersey_chart, requires_bike_type, collects_strava_link, manual_category_select,
  is_virtual, offers_shuttle, shuttle_points, id_doc_min_age
)
values (
  'Mirsharai Coastal Marathon 2027',
  'mirsharai-coastal-marathon-2027',
  'MCM27',
  '2027-02-05',
  'Bhuiarhat Beribandh, Katachara, Mirsharai Economic Zone, Chattogram',
  false,
  1000,
  '01785750821',
  array['bKash', 'Nagad', 'Rocket', 'Upay'],
  'রেজিস্ট্রেশন ফি ৪২.২ কিমি ১৭০০ টাকা, ২১.১ কিমি ১৫০০ টাকা, ১০ কিমি ১৪০০ টাকা — 01785750821 নম্বরে bKash, Nagad, Rocket অথবা Upay দিয়ে Cash Out করুন, তারপর Transaction ID টি ফর্মে দিন।
Fee: 42.2 km ৳1,700 · 21.1 km ৳1,500 · 10 km ৳1,400 — Cash Out to 01785750821 via bKash, Nagad, Rocket or Upay, then enter the Transaction ID in the form.',
  'স্টার্ট: শুক্রবার, ৫ ফেব্রুয়ারি ২০২৭, ভোর ৫:০০টা।
Start: Friday, 5 February 2027, 5:00 AM.

চট্টগ্রাম শহর থেকে ফ্রি শাটল বাস থাকবে — ফর্মে আপনার পিকআপ পয়েন্ট বেছে নিন।
Free shuttle bus from Chattogram city — pick your pickup point in the form.

৫০+ বয়সী (ভেটেরান) রানারদের NID/পাসপোর্টের ছবি আপলোড করতে হবে।
Veteran (50+) runners must upload a photo of their NID/passport.

সহযোগিতায়: ইয়ং পাওয়ার ইন সোশ্যাল অ্যাকশন (ইপসা)
Supported by Young Power in Social Action (YPSA)',
  '[
    {"size": "XS", "chest": 36, "length": 25},
    {"size": "S", "chest": 38, "length": 26},
    {"size": "M", "chest": 40, "length": 27},
    {"size": "L", "chest": 42, "length": 28},
    {"size": "XL", "chest": 44, "length": 29},
    {"size": "2XL", "chest": 46, "length": 30},
    {"size": "3XL", "chest": 48, "length": 31}
  ]'::jsonb,
  false,
  false,
  true,
  false,
  true,
  '[
    {"en": "Bahaddarhat", "bn": "বহদ্দারহাট"},
    {"en": "Chawkbazar", "bn": "চকবাজার"},
    {"en": "GEC", "bn": "জিইসি"},
    {"en": "Agrabad", "bn": "আগ্রাবাদ"},
    {"en": "New Market", "bn": "নিউমার্কেট"},
    {"en": "AK Khan", "bn": "একেখান"},
    {"en": "Boro Darogahat (Sitakunda)", "bn": "বড় দারোগা হাট (সীতাকুন্ড)"}
  ]'::jsonb,
  50
)
on conflict (slug) do nothing;

-- Twelve category rows: distance x gender x (General 0-49 / Veteran 50+), the
-- podium groups. The athlete only picks the distance tile (group_label); gender
-- and age on race day select the row behind it.
insert into categories (event_id, name, group_label, gender, min_age, max_age, fee, max_slots, display_order)
select e.id, c.name, c.group_label, c.gender, c.min_age, c.max_age, c.fee, c.max_slots, c.display_order
from events e
cross join (values
  ('42.2K Male General',   '42.2K', 'male',    0, 49,   1700, 250, 1),
  ('42.2K Female General', '42.2K', 'female',  0, 49,   1700, 250, 2),
  ('42.2K Male Veteran',   '42.2K', 'male',   50, null, 1700, 250, 3),
  ('42.2K Female Veteran', '42.2K', 'female', 50, null, 1700, 250, 4),
  ('21.1K Male General',   '21.1K', 'male',    0, 49,   1500, 350, 5),
  ('21.1K Female General', '21.1K', 'female',  0, 49,   1500, 350, 6),
  ('21.1K Male Veteran',   '21.1K', 'male',   50, null, 1500, 350, 7),
  ('21.1K Female Veteran', '21.1K', 'female', 50, null, 1500, 350, 8),
  ('10K Male General',     '10K',   'male',    0, 49,   1400, 400, 9),
  ('10K Female General',   '10K',   'female',  0, 49,   1400, 400, 10),
  ('10K Male Veteran',     '10K',   'male',   50, null, 1400, 400, 11),
  ('10K Female Veteran',   '10K',   'female', 50, null, 1400, 400, 12)
) as c(name, group_label, gender, min_age, max_age, fee, max_slots, display_order)
where e.slug = 'mirsharai-coastal-marathon-2027'
  and not exists (
    select 1 from categories cat where cat.event_id = e.id and cat.name = c.name
  );
