-- 0011_virtual_run_fee_update.sql
-- Fee change for Chatto Metro Virtual Run 2026: 5K 700, 10K 800, 21K 900
-- (was 800 / 900 / 1000). Both category rows per distance move together, and
-- the FEE rail copy in events.fee_note is re-stated to match.
--
-- Idempotent: safe to re-run.

update categories c
   set fee = v.fee
  from events e,
       (values ('5K', 700), ('10K', 800), ('21K', 900)) as v(name, fee)
 where c.event_id = e.id
   and e.slug = 'chatto-metro-virtual-run-2026'
   and c.name = v.name;

update events
   set fee_note = 'রেজিস্ট্রেশন ফি ৫ কিমি ৭০০ টাকা, ১০ কিমি ৮০০ টাকা, ২১ কিমি ৯০০ টাকা — 01785750821 নম্বরে bKash, Nagad, Rocket অথবা Upay দিয়ে Cash Out করুন, তারপর Transaction ID টি ফর্মে দিন।'
 where slug = 'chatto-metro-virtual-run-2026';
