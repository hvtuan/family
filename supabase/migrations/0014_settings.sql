-- 0014_settings.sql
--
-- Key-value settings store. Lets admins update site copy, contact
-- info, and integration API keys WITHOUT rebuilding the code.
--
-- Categories partition the UI:
--   site         — brand identity (vi/en names, motto, hometown, year)
--   contact      — admin email / phone shown on public + admin pages
--   integrations — public-safe API keys (Google Maps, etc.)
--   appearance   — default theme, accent options
--
-- Server-only secrets (SUPABASE_SERVICE_ROLE_KEY, etc.) intentionally
-- stay in env; they're never read by the public site so no need to
-- expose them through this admin-editable surface.

create table if not exists family.settings (
  key         text primary key,
  value       text,
  category    text not null default 'site'
    check (category in ('site', 'contact', 'integrations', 'appearance')),
  description text,
  updated_at  timestamptz not null default now(),
  updated_by  uuid references family.app_users(id) on delete set null
);

create index if not exists settings_category_idx on family.settings(category);

drop trigger if exists settings_set_updated_at on family.settings;
create trigger settings_set_updated_at
  before update on family.settings
  for each row execute function family.set_updated_at();

drop trigger if exists settings_audit on family.settings;
create trigger settings_audit
  after insert or update or delete on family.settings
  for each row execute function family.log_audit();

grant all on family.settings to service_role, postgres;

-- ─── Seed defaults from existing SITE constants ─────────────────────────
insert into family.settings (key, value, category, description) values
  -- Site identity
  ('site.brand_vi',       'Gia đình họ Nguyễn',          'site', 'Tên dòng họ (tiếng Việt) — hiện ở header + hero'),
  ('site.brand_en',       'The Nguyễn Family',           'site', 'Tên tiếng Anh (subtitle uppercase)'),
  ('site.hometown',       'Tịnh Khê, Sơn Tịnh, Quảng Ngãi','site', 'Quê hương khởi tổ'),
  ('site.hometown_en',    'Tinh Khe, Son Tinh, Quang Ngai','site', 'Hometown (latin)'),
  ('site.motto',          'Uống nước nhớ nguồn',         'site', 'Châm ngôn dòng họ'),
  ('site.motto_en',       'Drink water, remember the source','site', 'Motto (English)'),
  ('site.monogram',       'N1928',                       'site', 'Dấu ấn / monogram (chữ hoặc chuỗi ngắn)'),
  ('site.established',    '1928',                        'site', 'Năm khởi tổ'),
  ('site.surname',        'Nguyễn',                      'site', 'Họ'),

  -- Contact
  ('contact.admin_email', 'hvtuan0311@gmail.com',        'contact', 'Email admin chính — hiện ở /admin/help + login'),
  ('contact.admin_phone', '',                            'contact', 'SĐT admin (tùy chọn — không công khai)'),
  ('contact.public_url',  'https://family.huynhvantuan.net','contact','URL trang công khai'),

  -- Integrations
  ('integrations.google_maps_api_key', '', 'integrations',
    'Google Maps Platform API key. Cần Maps JavaScript API + Places API. Restrict theo HTTP referrer family.huynhvantuan.net/*'),

  -- Appearance
  ('appearance.default_theme', 'classic', 'appearance', 'Theme mặc định: classic / scroll / modern')
on conflict (key) do nothing;
