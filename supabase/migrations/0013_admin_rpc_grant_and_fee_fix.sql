-- 0013_admin_rpc_grant_and_fee_fix.sql
-- Two fixes found while verifying 0012 on the live DB.
--
-- 1. SECURITY: admin_register_participant() was executable by `anon`. Postgres
--    grants EXECUTE on every new function to PUBLIC, and Supabase's default
--    privileges add an explicit grant to anon — so "grant ... to authenticated"
--    alone never restricted anything. A caller with only the public anon key
--    could add entries that skip the capacity and dedupe guards. Revoke both.
--    Any future drop/recreate of this function must repeat the revoke.
--
-- 2. Chattogram Duathlon 2026: Female Masters fee was 3195; every duathlon
--    category is 3200.
--
-- Idempotent: safe to re-run.

revoke execute on function admin_register_participant(
  uuid, uuid, text, text, text, text, date, text, text, text, text, text,
  text, text, text, text, text, text, text, text, text, text, int, text, text,
  text, text, text
) from public, anon;

update categories c
   set fee = 3200
  from events e
 where c.event_id = e.id
   and e.slug = 'chattogram-duathlon-2026'
   and c.name = 'Female Masters'
   and c.fee = 3195;
