-- 0015_duathlon_fee_2700.sql
-- Chattogram Duathlon 2026 registration fee 3200 -> 2700.
--
-- Revenue on the dashboard is `amount_paid ?? category.fee`, and existing
-- registrations have amount_paid = null, so changing the category fee alone
-- would silently re-price everyone who already registered. Pin them to the
-- old fee first, then change the category fee and the payment note.
--
-- Idempotent: safe to re-run (the pin only touches rows still null).

update registrations r
   set amount_paid = 3200
  from events e
 where r.event_id = e.id
   and e.slug = 'chattogram-duathlon-2026'
   and r.registration_type = 'paid'
   and r.amount_paid is null;

update categories c
   set fee = 2700
  from events e
 where c.event_id = e.id
   and e.slug = 'chattogram-duathlon-2026';

update events
   set fee_note = replace(fee_note, '৩২০০', '২৭০০')
 where slug = 'chattogram-duathlon-2026';
