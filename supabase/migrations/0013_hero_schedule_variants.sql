-- 0013_hero_schedule_variants.sql
--
-- Adds 3 columns to family.hero_slides:
--
--   active_from    nullable timestamptz — slide is hidden until this moment
--   active_to      nullable timestamptz — slide is hidden after this moment
--   photo_id_mobile  nullable text FK to family.photos — different artwork for
--                    portrait viewports (< tablet breakpoint).  When NULL the
--                    public renderer uses the main photo_id on every device.
--
-- Useful for Tết / giỗ / event-driven slides that should only run for a window
-- and for different aspect ratios on phone vs desktop.

alter table family.hero_slides
  add column if not exists active_from timestamptz,
  add column if not exists active_to   timestamptz,
  add column if not exists photo_id_mobile text references family.photos(id) on delete set null;

create index if not exists hero_slides_active_window_idx
  on family.hero_slides(active_from, active_to)
  where active = true;
