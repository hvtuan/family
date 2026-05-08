-- 0017_memorial.sql
--
-- Memorial Layer (Tưởng niệm) — schema foundation.
--
-- See DESIGN-MEMORIAL.md for the full specification. This migration
-- adds:
--   1. incense_events       — append-only "thắp một nén tâm hương" log
--   2. condolences          — "Lời tưởng nhớ" with admin moderation
--   3. anniversary_alerts   — idempotency log for the daily cron
--   4. members extensions   — memorial_enabled / anniversary_calendar /
--                              death_date_lunar
--   5. app_users.preferred_lang — for email locale
--   6. settings extensions  — new "memorial" category + 6 keys seeded

-- ───────────────────────────────────────────────────────────────────
-- 1. incense_events
-- ───────────────────────────────────────────────────────────────────

create table if not exists family.incense_events (
  id                bigserial primary key,
  member_id         text not null references family.members(id) on delete cascade,
  anniversary_year  integer not null,
  visitor_name      text not null check (length(visitor_name) between 1 and 80),
  message           jsonb,
  ip_hash           text not null,
  created_at        timestamptz not null default now()
);
create index if not exists incense_member_year_idx
  on family.incense_events (member_id, anniversary_year);
create index if not exists incense_member_recent_idx
  on family.incense_events (member_id, created_at desc);

comment on table family.incense_events is
  'Append-only log of thắp tâm hương events on /memorial/[id] pages. Counter resets per anniversary_year so each yearly giỗ has its own tally.';
comment on column family.incense_events.ip_hash is
  'sha256(ip + INCENSE_IP_SALT) — never store raw IP. Used only for rate-limit.';

-- ───────────────────────────────────────────────────────────────────
-- 2. condolences (Lời tưởng nhớ)
-- ───────────────────────────────────────────────────────────────────

create table if not exists family.condolences (
  id                bigserial primary key,
  member_id         text not null references family.members(id) on delete cascade,
  visitor_name      text not null check (length(visitor_name) between 1 and 80),
  visitor_relation  text,
  body              jsonb not null,
  status            text not null default 'pending'
                     check (status in ('pending', 'approved', 'rejected')),
  ip_hash           text not null,
  reviewed_by       uuid references auth.users(id) on delete set null,
  reviewed_at       timestamptz,
  created_at        timestamptz not null default now()
);
create index if not exists condolence_member_pub_idx
  on family.condolences (member_id, status, created_at desc);
create index if not exists condolence_pending_idx
  on family.condolences (status)
  where status = 'pending';

comment on table family.condolences is
  'Lời tưởng nhớ submissions. Anonymous visitors leave name + body; admin moderation queue at /admin/condolences approves before public.';
comment on column family.condolences.body is
  'Localized JSONB: vi/en keys. At least one locale must be set.';

-- ───────────────────────────────────────────────────────────────────
-- 3. anniversary_alerts (cron audit / idempotency)
-- ───────────────────────────────────────────────────────────────────

create table if not exists family.anniversary_alerts (
  id                  bigserial primary key,
  member_id           text not null references family.members(id) on delete cascade,
  alert_type          text not null check (alert_type in ('t-7', 't-1', 'today')),
  anniversary_year    integer not null,
  anniversary_solar   date not null,
  sent_at             timestamptz not null default now(),
  recipients          jsonb not null,
  unique (member_id, alert_type, anniversary_year)
);

comment on table family.anniversary_alerts is
  'Idempotency + audit log for the daily cron at /admin/cron/anniversary-alerts. UNIQUE(member, type, year) ensures each alert is sent at most once.';

-- ───────────────────────────────────────────────────────────────────
-- 4. members extensions
-- ───────────────────────────────────────────────────────────────────

alter table family.members
  add column if not exists memorial_enabled boolean default true;

alter table family.members
  add column if not exists anniversary_calendar text default 'lunar';

do $$
begin
  if not exists (
    select 1 from information_schema.constraint_column_usage
    where table_schema = 'family'
      and table_name = 'members'
      and constraint_name = 'members_anniversary_calendar_check'
  ) then
    alter table family.members
      add constraint members_anniversary_calendar_check
      check (anniversary_calendar in ('lunar', 'solar', 'both'));
  end if;
end $$;

alter table family.members
  add column if not exists death_date_lunar jsonb;

comment on column family.members.memorial_enabled is
  'Per-member toggle. Defaults true for any member with a death_date. Admin disables for edge cases (privacy, incomplete records).';
comment on column family.members.anniversary_calendar is
  'Which calendar drives the giỗ alert: lunar (default, VN tradition), solar, or both (sends two alerts).';
comment on column family.members.death_date_lunar is
  'Manually-overridable lunar date JSONB: {year, month, day, isLeap}. When NULL, computed on-the-fly from death_date via lunar-typescript.';

-- ───────────────────────────────────────────────────────────────────
-- 5. app_users.preferred_lang
-- ───────────────────────────────────────────────────────────────────

alter table family.app_users
  add column if not exists preferred_lang text default 'vi';

do $$
begin
  if not exists (
    select 1 from information_schema.constraint_column_usage
    where table_schema = 'family'
      and table_name = 'app_users'
      and constraint_name = 'app_users_preferred_lang_check'
  ) then
    alter table family.app_users
      add constraint app_users_preferred_lang_check
      check (preferred_lang in ('vi', 'en'));
  end if;
end $$;

comment on column family.app_users.preferred_lang is
  'Locale used to render anniversary email templates. Defaults to vi. Future: drives /admin UI locale once EN catalog is filled.';

-- ───────────────────────────────────────────────────────────────────
-- 6. settings extensions: add "memorial" category + seed 6 keys
-- ───────────────────────────────────────────────────────────────────

alter table family.settings drop constraint if exists settings_category_check;
alter table family.settings add constraint settings_category_check
  check (category in (
    'site', 'contact', 'integrations', 'appearance',
    'seo', 'maps', 'privacy', 'social', 'analytics', 'smtp', 'hero',
    'memorial'
  ));

insert into family.settings (key, value, category, description, field_type, sort_order) values
  ('memorial.enable',                        'true',  'memorial',
   'Bật toàn bộ module Tưởng niệm (memorial pages + altar + banner + cron)',
   'boolean', 10),
  ('memorial.banner_days_before',            '7',     'memorial',
   'Banner trên trang chủ hiện trước giỗ N ngày',
   'number',  20),
  ('memorial.alert_days_before',             '7,1,0', 'memorial',
   'Cron gửi email các mốc nào (csv: 7,1,0 = T-7, T-1, đúng hôm giỗ)',
   'text',    30),
  ('memorial.condolences_require_approval',  'true',  'memorial',
   'Yêu cầu admin duyệt Lời tưởng nhớ trước khi hiển thị công khai',
   'boolean', 40),
  ('memorial.incense_rate_limit_per_hour',   '5',     'memorial',
   'Giới hạn số lần thắp tâm hương mỗi giờ trên một địa chỉ IP',
   'number',  50),
  ('memorial.chime_default_on',              'false', 'memorial',
   'Bật âm thanh chuông nhỏ khi thắp tâm hương (mặc định tắt)',
   'boolean', 60)
on conflict (key) do nothing;
