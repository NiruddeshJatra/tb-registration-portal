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
   set participation_note = 'রান সম্পন্ন করার সময়: ১–১৫ সেপ্টেম্বর ২০২৬। রান শেষে আপনার Strava অ্যাক্টিভিটির লিংক WhatsApp-এ পাঠান 01303358202 নম্বরে। যাচাই সম্পন্ন হলে ২৫ সেপ্টেম্বর থেকে মেডেল ও অন্যান্য সামগ্রী পাঠানো শুরু হবে।'
 where slug = 'chatto-metro-virtual-run-2026';
