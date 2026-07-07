-- 0004_payment_methods.sql
-- Widen accepted mobile-money channels to include Rocket and Upay, and offer
-- all four on the public form for Chattogram Duathlon 2026.
-- Idempotent; apply manually to the live DB (this repo does not auto-apply).

alter table registrations drop constraint if exists registrations_payment_method_check;
alter table registrations add constraint registrations_payment_method_check
  check (payment_method in ('bKash', 'Nagad', 'Rocket', 'Upay'));

update events
set payment_methods = array['bKash', 'Nagad', 'Rocket', 'Upay'],
    fee_note = 'রেজিস্ট্রেশন ফি ৩৫০০ টাকা 01785750821 নম্বরে bKash, Nagad, Rocket অথবা Upay দিয়ে Send Money করুন, তারপর Transaction ID টি ফর্মে দিন।'
where slug = 'chattogram-duathlon-2026';
