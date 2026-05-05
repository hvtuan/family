-- 0002_content.sql
-- Content tables (family schema). Mirror src/content.config.ts Zod schemas.
-- snake_case columns; bilingual fields kept as separate columns (name/name_en).
-- Embedded arrays (achievements, anecdotes, member.embedded_photos, social)
-- stored as jsonb to preserve the YAML/Zod shape during migration.

-- ─── members ─────────────────────────────────────────────────────────────────
create table if not exists family.members (
  id text primary key,
  name text not null,
  name_en text,
  birth_name text,
  nickname text,

  gen smallint not null check (gen between 1 and 8),
  role text not null,
  role_en text,
  birth_order smallint,
  is_family_head boolean not null default false,

  born text not null,
  lunar_born text,
  birth_place text,
  died text,
  lunar_died text,
  death_place text,
  death_anniversary text,
  gravesite text,

  zodiac text,
  elemental_sign text,

  bio text not null,
  bio_en text not null,
  body_md text,

  location text,
  job text,
  job_en text,
  education text,
  hobbies jsonb not null default '[]'::jsonb,
  religion text,
  military text,

  father_id text references family.members(id) on delete set null deferrable initially deferred,
  mother_id text references family.members(id) on delete set null deferrable initially deferred,
  spouse_id text references family.members(id) on delete set null deferrable initially deferred,

  quote text,
  achievements jsonb not null default '[]'::jsonb,
  anecdotes jsonb not null default '[]'::jsonb,

  photo text,
  embedded_photos jsonb not null default '[]'::jsonb,
  pattern text check (pattern in ('hatch','dots','lines','bamboo','glow')),

  branch text not null default 'both' check (branch in ('noi','ngoai','both')),

  contact_public boolean not null default false,
  phone text,
  email text,
  address text,
  social jsonb,

  status text not null default 'published' check (status in ('draft','published')),
  tags jsonb not null default '[]'::jsonb,
  updated_at_user text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references family.app_users(id) on delete set null,
  updated_by uuid references family.app_users(id) on delete set null
);

create index if not exists members_gen_idx on family.members(gen);
create index if not exists members_branch_idx on family.members(branch);
create index if not exists members_status_idx on family.members(status);
create index if not exists members_father_idx on family.members(father_id);
create index if not exists members_mother_idx on family.members(mother_id);

-- ─── member_children ─────────────────────────────────────────────────────────
create table if not exists family.member_children (
  parent_id text references family.members(id) on delete cascade,
  child_id text references family.members(id) on delete cascade,
  primary key (parent_id, child_id)
);

create index if not exists member_children_child_idx on family.member_children(child_id);

-- ─── timeline ────────────────────────────────────────────────────────────────
create table if not exists family.timeline (
  id bigserial primary key,
  year int not null,
  date text,
  lunar boolean not null default false,
  title text not null,
  title_en text not null,
  desc_text text not null,
  desc_en text not null,
  category text check (category in
    ('founding','birth','marriage','death','milestone','gathering')),
  image text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references family.app_users(id) on delete set null,
  updated_by uuid references family.app_users(id) on delete set null
);

create index if not exists timeline_year_idx on family.timeline(year);

create table if not exists family.timeline_members (
  timeline_id bigint references family.timeline(id) on delete cascade,
  member_id text references family.members(id) on delete cascade,
  primary key (timeline_id, member_id)
);

create index if not exists timeline_members_member_idx on family.timeline_members(member_id);

-- ─── traditions ──────────────────────────────────────────────────────────────
create table if not exists family.traditions (
  id text primary key,
  name text not null,
  name_en text not null,
  category text not null default 'food'
    check (category in ('food','festival','ceremony','craft')),
  icon text not null check (icon in ('bowl','fish','leaf','shell','incense','blossom')),
  desc_text text not null,
  desc_en text not null,
  origin text,
  image text,
  body_md text,
  tags jsonb not null default '[]'::jsonb,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references family.app_users(id) on delete set null,
  updated_by uuid references family.app_users(id) on delete set null
);

-- ─── photos ──────────────────────────────────────────────────────────────────
create table if not exists family.photos (
  id text primary key,
  src text not null,
  caption text not null,
  caption_en text not null,
  year int,
  date text,
  location text,
  album text,
  featured boolean not null default false,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references family.app_users(id) on delete set null,
  updated_by uuid references family.app_users(id) on delete set null
);

create index if not exists photos_year_idx on family.photos(year);
create index if not exists photos_featured_idx on family.photos(featured) where featured = true;

create table if not exists family.photo_members (
  photo_id text references family.photos(id) on delete cascade,
  member_id text references family.members(id) on delete cascade,
  primary key (photo_id, member_id)
);

create index if not exists photo_members_member_idx on family.photo_members(member_id);

-- ─── quotes ──────────────────────────────────────────────────────────────────
create table if not exists family.quotes (
  id bigserial primary key,
  text_vi text not null,
  text_en text,
  author text not null,
  author_ref text references family.members(id) on delete set null,
  type text not null default 'family'
    check (type in ('proverb','family','poem','letter')),
  context text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references family.app_users(id) on delete set null,
  updated_by uuid references family.app_users(id) on delete set null
);

-- ─── dates ───────────────────────────────────────────────────────────────────
create table if not exists family.dates (
  id bigserial primary key,
  date text not null,
  calendar text not null default 'solar' check (calendar in ('lunar','solar')),
  name text not null,
  name_en text not null,
  type text not null check (type in
    ('memorial','festival','birthday','national','anniversary','gathering')),
  member_id text references family.members(id) on delete set null,
  year int,
  recurring boolean not null default true,
  notes text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references family.app_users(id) on delete set null,
  updated_by uuid references family.app_users(id) on delete set null
);

create index if not exists dates_calendar_date_idx on family.dates(calendar, date);

-- ─── locations ───────────────────────────────────────────────────────────────
create table if not exists family.locations (
  id text primary key,
  name text not null,
  name_en text not null,
  province text not null,
  lat double precision not null,
  lng double precision not null,
  is_hometown boolean not null default false,
  description text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references family.app_users(id) on delete set null,
  updated_by uuid references family.app_users(id) on delete set null
);

create table if not exists family.location_members (
  location_id text references family.locations(id) on delete cascade,
  member_id text references family.members(id) on delete cascade,
  primary key (location_id, member_id)
);

create index if not exists location_members_member_idx on family.location_members(member_id);
