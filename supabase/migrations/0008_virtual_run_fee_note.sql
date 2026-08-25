-- 0008_virtual_run_fee_note.sql
-- Fee/payment instruction for the FEE line on the Chatto Metro Virtual Run
-- registration rail, mirroring the duathlon's wording. Unlike the duathlon
-- this event has three fees, one per distance, so all three are listed.
--
-- NOTE: the payment number below is still the duathlon's (01785750821).
-- Replace it here and in events.payment_number if the virtual run collects
-- to a different number.
--
-- Idempotent: safe to re-run.

update events
   set fee_note = 'রেজিস্ট্রেশন ফি ৫ কিমি ৮০০ টাকা, ১০ কিমি ৯০০ টাকা, ২১ কিমি ১০০০ টাকা — 01785750821 নম্বরে bKash, Nagad, Rocket অথবা Upay দিয়ে Cash Out করুন, তারপর Transaction ID টি ফর্মে দিন।'
 where slug = 'chatto-metro-virtual-run-2026';
