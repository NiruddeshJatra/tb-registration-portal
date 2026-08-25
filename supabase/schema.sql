-- Triathlon Bangladesh Registration Portal — schema.sql
-- Idempotent where practical. Run once in the Supabase SQL editor (or `supabase db push`).
-- After running: disable email signups in Auth settings, create admin users from the dashboard.

-- ============================================================================
-- EXTENSIONS
-- ============================================================================
create extension if not exists pgcrypto; -- gen_random_uuid()

-- ============================================================================
-- TABLES
-- ============================================================================

create table if not exists events (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  short_code text not null unique, -- used as the ref_code prefix, e.g. 'CD26'
  event_date date not null,
  venue text not null,
  registration_open boolean not null default false,
  registration_deadline date,
  max_total_slots int, -- null = unlimited; total cap across all categories combined
  fee_note text,
  payment_number text,
  payment_methods text[] not null default '{}',
  jersey_chart jsonb not null default '[]',
  reg_counter int not null default 0, -- incremented atomically to build ref_code
  created_at timestamptz not null default now()
);

create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references events(id) on delete cascade,
  name text not null,
  gender text not null check (gender in ('male', 'female')),
  min_age int not null,
  max_age int, -- null = no upper bound
  fee int not null,
  max_slots int, -- null = unlimited
  display_order int not null default 0
);

create table if not exists registrations (
  id uuid primary key default gen_random_uuid(),
  ref_code text unique, -- assigned inside register_participant()
  event_id uuid not null references events(id),
  category_id uuid references categories(id), -- nullable: non-runner roles may have no category
  full_name text not null,
  phone text not null,
  email text not null,
  gender text not null check (gender in ('male', 'female')),
  date_of_birth date not null,
  blood_group text check (blood_group in ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-')),
  jersey_size text check (jersey_size in ('XS', 'S', 'M', 'L', 'XL', '2XL', '3XL')),
  address text,
  emergency_phone text not null,
  comments text,
  payment_method text check (payment_method in ('bKash', 'Nagad', 'Rocket', 'Upay')),
  payment_sender text,
  transaction_id text,
  amount_paid int,
  consent_given_at timestamptz not null,
  participant_role text not null default 'runner'
    check (participant_role in ('runner', 'organizer', 'crew', 'mentor', 'ambassador', 'guest', 'pacer', 'volunteer')),
  entry_source text not null default 'self'
    check (entry_source in ('self', 'admin_manual', 'group_import')),
  registration_type text not null default 'paid'
    check (registration_type in ('paid', 'discounted', 'complimentary')),
  discount_reason text,
  complimentary_reason text,
  authorized_by text,
  group_name text,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'rejected', 'cancelled')),
  managed_by text,
  admin_comment text,
  status_changed_at timestamptz,
  created_at timestamptz not null default now(),
  constraint registrations_event_txid_key unique (event_id, transaction_id),
  constraint chk_full_name check (full_name ~ '^[A-Za-z][A-Za-z .''-]{1,79}$'),
  constraint chk_email check (email ~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$'),
  constraint chk_phone_diff check (phone <> emergency_phone),
  constraint chk_phone_format check (phone ~ '^01[3-9][0-9]{8}$'),
  constraint chk_emergency_phone_format check (emergency_phone ~ '^01[3-9][0-9]{8}$'),
  constraint chk_txid check (transaction_id is null or transaction_id ~ '^[A-Z0-9]{8,15}$'),
  constraint chk_txid_required check (registration_type = 'complimentary' or transaction_id is not null)
);

-- Only self-submitted registrations must have a unique phone per event.
-- Admin bulk/group entries may legitimately share a contact phone.
create unique index if not exists registrations_event_phone_self_key
  on registrations (event_id, phone)
  where entry_source = 'self';

create index if not exists registrations_event_category_idx on registrations (event_id, category_id);
create index if not exists registrations_status_idx on registrations (status);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

alter table events enable row level security;
alter table categories enable row level security;
alter table registrations enable row level security;

drop policy if exists events_select_all on events;
create policy events_select_all on events for select using (true);
drop policy if exists events_auth_all on events;
create policy events_auth_all on events for all to authenticated using (true) with check (true);

drop policy if exists categories_select_all on categories;
create policy categories_select_all on categories for select using (true);
drop policy if exists categories_auth_all on categories;
create policy categories_auth_all on categories for all to authenticated using (true) with check (true);

-- registrations: anon gets NO policy at all (default-deny: no select/insert/update/delete).
-- All public writes go through register_participant() below, which is SECURITY DEFINER
-- and owned by a role that bypasses RLS (the default Supabase table owner).
drop policy if exists registrations_auth_select on registrations;
create policy registrations_auth_select on registrations for select to authenticated using (true);
drop policy if exists registrations_auth_insert on registrations;
create policy registrations_auth_insert on registrations for insert to authenticated with check (true);
drop policy if exists registrations_auth_update on registrations;
create policy registrations_auth_update on registrations for update to authenticated using (true) with check (true);
-- No delete policy for anyone: cancellation is a status change, not a row deletion (keeps the audit trail).

-- ============================================================================
-- register_participant(): the ONLY public write path into registrations
-- ============================================================================
-- Returns jsonb:
--   success -> {"ok": true, "ref_code", "category_name", "fee", "status"}
--   failure -> {"ok": false, "error": one of
--       'event_not_found' | 'registration_closed' | 'deadline_passed' | 'event_full' |
--       'bad_phone' | 'no_category' | 'category_full' | 'dup_txid' | 'dup_phone'}
--
-- Atomicity of the capacity guards: we take pg_advisory_xact_lock() keyed on
-- the event id (total slots) and separately on the category id (per-category
-- slots). This serializes concurrent calls for the SAME event/category — the
-- second caller blocks until the first commits/rolls back, so the "count
-- current registrations" + "insert" pair can never race and oversell either
-- cap. Locks are released automatically at the end of the transaction.

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
  p_participant_role text default 'runner'
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

  -- 2. age + category match
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
      participant_role, entry_source
    ) values (
      v_ref_code, v_event.id, v_category.id, v_full_name, v_phone, p_email, p_gender, p_date_of_birth,
      p_blood_group, p_jersey_size, p_address, v_emergency_phone, p_comments,
      p_payment_method, p_payment_sender, v_transaction_id, now(),
      coalesce(p_participant_role, 'runner'), 'self'
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
  text, text, text, text, text, date, text, text, text, text, text, text, text, text, text
) to anon, authenticated;

-- ============================================================================
-- admin_register_participant(): manual/group entry path for the admin dashboard.
-- Only authenticated users can execute this (no grant to anon). Unlike the
-- public RPC, it accepts an explicit category (nullable, for non-runner roles)
-- and skips the capacity/phone-dedupe guards — admins are trusted and can see
-- slot counts on the dashboard. It still uses the same atomic per-event
-- counter for ref_code and still guards against duplicate transaction IDs.
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
  p_amount_paid int default null
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
      complimentary_reason, authorized_by, group_name
    ) values (
      v_ref_code, v_event.id, p_category_id, v_full_name, v_phone, p_email, p_gender, p_date_of_birth,
      p_blood_group, p_jersey_size, p_address, v_emergency_phone, p_comments,
      p_payment_method, p_payment_sender, v_transaction_id, p_amount_paid, now(),
      p_participant_role, p_entry_source, p_registration_type, p_discount_reason,
      p_complimentary_reason, p_authorized_by, p_group_name
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
  text, text, text, text, text, text, text, text, text, text, int
) to authenticated;

-- ============================================================================
-- public_event_slots(): read-only slot telemetry for the public registration
-- rail. anon has no direct read on `registrations`, so this SECURITY DEFINER
-- function exposes only two aggregate numbers: approved count + the cap.
-- ============================================================================
create or replace function public_event_slots(p_event_slug text)
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select jsonb_build_object(
    'claimed', (
      select count(*)
        from registrations r
        join events e on e.id = r.event_id
       where e.slug = p_event_slug
         and r.status = 'approved'
    ),
    'cap', (select max_total_slots from events where slug = p_event_slug)
  );
$$;

grant execute on function public_event_slots(text) to anon, authenticated;

-- ============================================================================
-- SEED DATA — Chattogram Duathlon 2026
-- ============================================================================

insert into events (name, slug, short_code, event_date, venue, registration_open, max_total_slots, payment_number, payment_methods, fee_note, jersey_chart)
values (
  'Chattogram Duathlon 2026',
  'chattogram-duathlon-2026',
  'CD26',
  '2026-11-06',
  'বাকলিয়া স্টেডিয়াম, নোমান কলেজ রোড, চট্টগ্রাম',
  true,
  250,
  '01785750821',
  array['bKash', 'Nagad', 'Rocket', 'Upay'],
  'রেজিস্ট্রেশন ফি ৩৫০০ টাকা 01785750821 নম্বরে bKash, Nagad, Rocket অথবা Upay দিয়ে Send Money করুন, তারপর Transaction ID টি ফর্মে দিন।',
  '[
    {"size": "XS", "chest": 34, "length": 24},
    {"size": "S", "chest": 36, "length": 25},
    {"size": "M", "chest": 38, "length": 26},
    {"size": "L", "chest": 40, "length": 27},
    {"size": "XL", "chest": 42, "length": 28},
    {"size": "2XL", "chest": 44, "length": 29},
    {"size": "3XL", "chest": 46, "length": 30}
  ]'::jsonb
)
on conflict (slug) do update set
  event_date = excluded.event_date,
  venue = excluded.venue,
  max_total_slots = excluded.max_total_slots,
  payment_number = excluded.payment_number,
  payment_methods = excluded.payment_methods,
  fee_note = excluded.fee_note,
  jersey_chart = excluded.jersey_chart;

insert into categories (event_id, name, gender, min_age, max_age, fee, max_slots, display_order)
select id, c.name, c.gender, c.min_age, c.max_age, 3500, null, c.display_order
from events e
cross join (values
  ('Male General', 'male', 18, 39, 1),
  ('Female General', 'female', 18, 39, 2),
  ('Male Masters', 'male', 40, null, 3),
  ('Female Masters', 'female', 40, null, 4)
) as c(name, gender, min_age, max_age, display_order)
where e.slug = 'chattogram-duathlon-2026'
  and not exists (
    select 1 from categories cat where cat.event_id = e.id and cat.name = c.name
  );

-- keep fee/slots current if this script is re-run after categories already exist
update categories cat
set fee = 3500, max_slots = null
from events e
where cat.event_id = e.id and e.slug = 'chattogram-duathlon-2026';
