-- 0007_virtual_event_presentation.sql
-- Presentation-only follow-up to 0006. No function signatures change here.
--
-- `is_virtual` marks an event that has no race day and no bikes. The public
-- registration rail uses it to drop the DATE line and to build the distance
-- strip from the event's own categories instead of the duathlon's
-- 10K-run / 40K-bike / 5K-run legs, and the wizard uses it to drop the
-- pro-jersey fit warning (virtual runners get a regular t-shirt).
--
-- Idempotent: safe to re-run.

alter table events add column if not exists is_virtual boolean not null default false;

update events
   set is_virtual = true
 where slug = 'chatto-metro-virtual-run-2026';

-- T-shirt sizing for the virtual run, anchored on M (chest 40", length 27")
-- and XL (44", 29"): each step up adds 2" of chest and 1" of length.
-- This replaces the duathlon's pro-jersey chart, which runs 2" smaller.
update events
   set jersey_chart = '[
    {"size": "XS", "chest": 36, "length": 25},
    {"size": "S", "chest": 38, "length": 26},
    {"size": "M", "chest": 40, "length": 27},
    {"size": "L", "chest": 42, "length": 28},
    {"size": "XL", "chest": 44, "length": 29},
    {"size": "2XL", "chest": 46, "length": 30},
    {"size": "3XL", "chest": 48, "length": 31}
  ]'::jsonb
 where slug = 'chatto-metro-virtual-run-2026';
