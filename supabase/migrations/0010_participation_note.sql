-- 0010_participation_note.sql
-- Free-text participation instructions shown on the registration rail
-- (alongside FEE) for events that need post-registration action from the
-- athlete. Nullable: events without one render nothing.
--
-- Motivation: a virtual run's Strava proof link cannot exist at registration
-- time — the run happens afterwards. So the public wizard no longer asks for
-- it; the link arrives over WhatsApp and an admin records it against the
-- registration later. This note is what tells the athlete that.
--
-- Idempotent: safe to re-run.

alter table events add column if not exists participation_note text;

update events
   set participation_note = 'রেজিস্ট্রেশনের লাস্ট ডেইট ১৫ই সেপ্টেম্বর।

১৬ সেপ্টেম্বর থেকে ৩০ সেপ্টেম্বরের মধ্যে রান ডাটা পাঠাতে হবে 01303-358202 (Whatsapp) এই নম্বরে।

৩০ তারিখ থেকে ডাটা চেক করে আপনাদের পার্সেল পাঠিয়ে দেয়া হবে।'
 where slug = 'chatto-metro-virtual-run-2026';
