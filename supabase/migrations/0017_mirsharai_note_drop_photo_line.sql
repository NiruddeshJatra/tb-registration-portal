-- 0017_mirsharai_note_drop_photo_line.sql
-- 0016 replaced the veteran NID/passport photo with an NID / birth
-- registration number for everyone, but Mirsharai's participation_note (the
-- rail's info block) still told 50+ runners to upload a photo. Drop that
-- Bangla + English pair, along with the blank line before it.
--
-- Idempotent: a no-op once the lines are gone.

update events
   set participation_note = regexp_replace(
         participation_note,
         '[\r\n]*[^\r\n]*NID/পাসপোর্টের ছবি[^\r\n]*[\r\n]+[^\r\n]*Veteran \(50\+\) runners must upload[^\r\n]*',
         '',
         'g'
       )
 where slug = 'mirsharai-coastal-marathon-2027';

-- Check: expect false.
select participation_note ~ 'NID/passport' as still_mentions_photo
  from events
 where slug = 'mirsharai-coastal-marathon-2027';
