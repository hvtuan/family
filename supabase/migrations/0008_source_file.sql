-- 0008_source_file.sql
-- Phase 2/P2: track which YAML/MD file each row was imported from, so the
-- content-migration script can do idempotent upsert on tables whose primary
-- key is a bigserial (timeline, quotes, dates) and therefore has no natural
-- identity from the YAML.
--
-- Tables already keyed by text (members, traditions, photos, locations) don't
-- need this — they upsert by their natural id field.

alter table family.timeline add column if not exists source_file text;
alter table family.quotes   add column if not exists source_file text;
alter table family.dates    add column if not exists source_file text;

create unique index if not exists timeline_source_file_idx
  on family.timeline(source_file) where source_file is not null;
create unique index if not exists quotes_source_file_idx
  on family.quotes(source_file) where source_file is not null;
create unique index if not exists dates_source_file_idx
  on family.dates(source_file) where source_file is not null;
