-- 0012_hero_slides.sql
--
-- Hero slideshow on the public homepage. Each slide references an
-- existing family.photos row (image or video) so admins can reuse the
-- media library — upload once, feature anywhere.
--
-- Per-slide overrides for the hero context (headline / CTA / advance
-- duration) are optional; defaults make the row work as soon as a
-- photo is attached.

create table if not exists family.hero_slides (
  id           bigserial primary key,
  photo_id     text not null references family.photos(id) on delete cascade,
  sort_order   int  not null default 0,
  active       boolean not null default true,

  -- Optional overrides shown over the slide. When null the public
  -- renderer falls back to the photo's caption / alt_vi.
  headline_vi  text,
  headline_en  text,

  cta_label    text,
  cta_href     text,

  -- Auto-advance time in ms (Embla autoplay plugin). 0 disables.
  duration_ms  int  not null default 6000,

  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  created_by   uuid references family.app_users(id) on delete set null,
  updated_by   uuid references family.app_users(id) on delete set null
);

create index if not exists hero_slides_active_order_idx
  on family.hero_slides(active, sort_order);
create index if not exists hero_slides_photo_idx
  on family.hero_slides(photo_id);

-- Updated_at trigger reusing existing helper.
drop trigger if exists hero_slides_set_updated_at on family.hero_slides;
create trigger hero_slides_set_updated_at
  before update on family.hero_slides
  for each row execute function family.set_updated_at();

-- Audit log trigger.
drop trigger if exists hero_slides_audit on family.hero_slides;
create trigger hero_slides_audit
  after insert or update or delete on family.hero_slides
  for each row execute function family.log_audit();

grant all on family.hero_slides to service_role, postgres;
grant usage, select on sequence family.hero_slides_id_seq to service_role, postgres;
