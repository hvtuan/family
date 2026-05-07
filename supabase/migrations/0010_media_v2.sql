-- 0010_media_v2.sql
--
-- Media management v2 (DESIGN-MEDIA-V2.md):
--   1. photo_members gains per-link `note` + `role` so the same photo can
--      have different captions for different members it tags.
--   2. photos gains variant URLs (thumb/medium) + image metadata
--      (width/height/bytes/mime/exif_stripped) and a `tags` text[].
--   3. timeline + traditions get a `photo_id` FK so a single photos row
--      can be the "cover" image instead of duplicating uploads. Existing
--      .image text column kept until M5 backfill is verified.
--   4. New M2M tables photo_timeline + photo_locations to allow multiple
--      photos per event/location.
--
-- Reversible: every change is additive (new columns nullable / new
-- tables). Drop columns + tables to roll back; data unaffected.

-- ─── photo_members: per-link metadata ───────────────────────────────────────
alter table family.photo_members
  add column if not exists note text,
  add column if not exists role text not null default 'in_photo'
    check (role in ('in_photo','referenced','taken_by'));

-- ─── photos: variants + metadata + tags ─────────────────────────────────────
alter table family.photos
  add column if not exists src_thumb text,
  add column if not exists src_medium text,
  add column if not exists width int,
  add column if not exists height int,
  add column if not exists bytes int,
  add column if not exists mime text,
  add column if not exists exif_stripped boolean not null default true,
  add column if not exists alt_vi text,
  add column if not exists alt_en text,
  add column if not exists tags text[] not null default '{}'::text[];

create index if not exists photos_tags_idx on family.photos using gin (tags);

-- ─── timeline + traditions cover photo FK ──────────────────────────────────
alter table family.timeline
  add column if not exists photo_id text references family.photos(id) on delete set null;

alter table family.traditions
  add column if not exists photo_id text references family.photos(id) on delete set null;

create index if not exists timeline_photo_idx on family.timeline(photo_id);
create index if not exists traditions_photo_idx on family.traditions(photo_id);

-- ─── photo_timeline: multi-photo per event ──────────────────────────────────
create table if not exists family.photo_timeline (
  photo_id    text   references family.photos(id) on delete cascade,
  timeline_id bigint references family.timeline(id) on delete cascade,
  sort_order  int    not null default 0,
  primary key (photo_id, timeline_id)
);

create index if not exists photo_timeline_event_idx on family.photo_timeline(timeline_id);

-- ─── photo_locations: photos taken at a location ───────────────────────────
create table if not exists family.photo_locations (
  photo_id    text references family.photos(id) on delete cascade,
  location_id text references family.locations(id) on delete cascade,
  primary key (photo_id, location_id)
);

create index if not exists photo_locations_loc_idx on family.photo_locations(location_id);

-- ─── grants for service_role + postgres (mirrors 0007) ─────────────────────
grant all on family.photo_timeline to service_role, postgres;
grant all on family.photo_locations to service_role, postgres;

-- M2M tables intentionally not audited (matches existing pattern of
-- photo_members, timeline_members, member_children, location_members).
-- log_audit() reads `id` via to_jsonb(new)->>'id' which is null for
-- composite-PK rows; auditing the parent rows captures relevant intent.
