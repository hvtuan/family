-- 0009_drop_embedded_photos.sql
--
-- Phase 1 stored member photos as a JSONB array on
-- family.members.embedded_photos. Phase 2 (commit 4d0378e, the
-- media-2/3 step) migrated every entry into family.photos +
-- photo_members and stopped reading the column from the public site.
-- Drop the now-unused column so the schema reflects reality.
--
-- Reversible by re-adding the column and replaying the migrate-embedded
-- script's reverse — but the source data was small (≤ a handful of
-- rows) and already lives in family.photos, so a roll-back would
-- realistically come from photo_members joins, not from this column.

alter table family.members drop column if exists embedded_photos;
