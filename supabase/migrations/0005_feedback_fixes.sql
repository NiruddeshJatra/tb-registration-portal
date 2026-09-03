-- 0005_feedback_fixes.sql
-- Post-redesign feedback round. Idempotent; safe to re-run.
--   • transaction_id may be up to 15 chars (was 8-12)
--   • Rocket + Upay accepted as payment methods (also in 0004)
--   • event venue / fee note / payment methods refreshed
--   • public_event_slots(): approved-count telemetry for the public rail (anon)
--   • admin_register_participant(): friendly dup-phone guard for single manual adds

-- ── transaction_id length ──
alter table registrations drop constraint if exists chk_txid;
alter table registrations add constraint chk_txid
  check (transaction_id is null or transaction_id ~ '^[A-Z0-9]{8,15}$');

-- ── payment channels ──
alter table registrations drop constraint if exists registrations_payment_method_check;
alter table registrations add constraint registrations_payment_method_check
  check (payment_method in ('bKash', 'Nagad', 'Rocket', 'Upay'));

-- ── event data ──
update events set
  venue = 'বাকলিয়া স্টেডিয়াম, নোমান কলেজ রোড, চট্টগ্রাম',
  payment_methods = array['bKash', 'Nagad', 'Rocket', 'Upay'],
  fee_note = 'রেজিস্ট্রেশন ফি ৩৫০০ টাকা 01785750821 নম্বরে bKash, Nagad, Rocket অথবা Upay দিয়ে Cash Out করুন, তারপর Transaction ID টি ফর্মে দিন।'
where slug = 'chattogram-duathlon-2026';

-- ── public slot telemetry ──
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

-- ── register_participant(): txid regex widened to 8-15 ──
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

  v_full_name := initcap(trim(regexp_replace(p_full_name, '\s+', ' ', 'g')));
  v_full_name := regexp_replace(v_full_name, '\yMd\.?\y', 'Md.', 'gi');
  if v_full_name !~ '^[A-Za-z][A-Za-z .''-]{1,79}$' then
    return jsonb_build_object('ok', false, 'error', 'bad_name');
  end if;

  v_transaction_id := upper(trim(p_transaction_id));
  if v_transaction_id !~ '^[A-Z0-9]{8,15}$' then
    return jsonb_build_object('ok', false, 'error', 'bad_txid');
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

  update events set reg_counter = reg_counter + 1 where id = v_event.id returning reg_counter into v_counter;
  v_ref_code := v_event.short_code || '-' || lpad(v_counter::text, 6, '0');

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

-- ── admin_register_participant(): txid 8-15 + friendly dup-phone guard ──
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
      elsif v_constraint = 'registrations_event_phone_self_key' then
        return jsonb_build_object('ok', false, 'error', 'dup_phone');
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
