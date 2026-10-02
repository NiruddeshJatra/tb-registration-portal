-- 0014_admin_allowlist.sql
-- From code review of 0012/0013. Until now "admin" meant "any authenticated
-- session": every policy and the admin RPC trusted the `authenticated` role.
-- That only holds while sign-ups stay disabled in the Auth settings — one
-- toggle away from any signed-up stranger reading NID photos and the whole
-- registrations table. Admin access is now an explicit allowlist.
--
-- 1. `admins` table + is_admin(). Seeded with the two existing dashboard-created
--    users, who are the admins. A NEW admin needs a row here as well as an Auth
--    user:  insert into admins (user_id) select id from auth.users where email = '...';
-- 2. Every `authenticated` policy (events, categories, registrations, and the
--    id-documents bucket's select/delete) now also requires is_admin().
-- 3. admin_register_participant() rejects non-admins ('not_authorized') and
--    archived events ('event_not_found'). Same signature as 0012, so CREATE OR
--    REPLACE replaces in place and the 0013 revoke from public/anon survives.
--
-- Idempotent: safe to re-run.

-- ============================================================================
-- 1. ALLOWLIST
-- ============================================================================
create table if not exists admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

-- RLS on with no policies: nobody reads or writes this through the API. Only
-- is_admin() (security definer) and the SQL editor can see it.
alter table admins enable row level security;

insert into admins (user_id)
select id from auth.users
on conflict (user_id) do nothing;

create or replace function is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (select 1 from admins where user_id = auth.uid());
$$;

revoke execute on function is_admin() from public, anon;
grant execute on function is_admin() to authenticated;

-- ============================================================================
-- 2. POLICIES
-- ============================================================================
drop policy if exists events_auth_all on events;
create policy events_auth_all on events
  for all to authenticated using (is_admin()) with check (is_admin());

drop policy if exists categories_auth_all on categories;
create policy categories_auth_all on categories
  for all to authenticated using (is_admin()) with check (is_admin());

drop policy if exists registrations_auth_select on registrations;
create policy registrations_auth_select on registrations
  for select to authenticated using (is_admin());

drop policy if exists registrations_auth_insert on registrations;
create policy registrations_auth_insert on registrations
  for insert to authenticated with check (is_admin());

drop policy if exists registrations_auth_update on registrations;
create policy registrations_auth_update on registrations
  for update to authenticated using (is_admin()) with check (is_admin());

-- ID photos: uploading stays open (the public form needs it); reading and
-- deleting are admin-only. A signed URL is only issued to a caller who passes
-- the SELECT policy, so this is what makes the photos admin-only.
drop policy if exists id_documents_auth_select on storage.objects;
create policy id_documents_auth_select on storage.objects
  for select to authenticated
  using (bucket_id = 'id-documents' and public.is_admin());

drop policy if exists id_documents_auth_delete on storage.objects;
create policy id_documents_auth_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'id-documents' and public.is_admin());

-- ============================================================================
-- 3. admin_register_participant()
-- ============================================================================
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
