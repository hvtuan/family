-- 0015_settings_expanded.sql
--
-- Expand the settings catalog: add `field_type` + `sort_order` columns,
-- broaden the category CHECK to allow seo / maps / privacy / social /
-- analytics / smtp / hero, and seed ~25 new useful keys.
--
-- field_type drives the admin form widget:
--   text       — single-line input (default)
--   password   — masked input with reveal toggle (API keys, secrets)
--   textarea   — multi-line
--   number     — type=number
--   boolean    — switch (value is "true"/"false")
--   url        — url input + thumbnail preview if value looks like image
--   color      — color picker (#hex)
--   select:a,b,c — dropdown of comma-separated options

alter table family.settings
  add column if not exists field_type  text not null default 'text',
  add column if not exists sort_order  int  not null default 100;

-- Replace the category CHECK to include new buckets.
alter table family.settings drop constraint if exists settings_category_check;
alter table family.settings add constraint settings_category_check
  check (category in (
    'site', 'contact', 'integrations', 'appearance',
    'seo', 'maps', 'privacy', 'social', 'analytics', 'smtp', 'hero', 'memorial'
  ));

-- ─── Update existing rows with field_type + ordering ───────────────────
update family.settings set field_type='text',  sort_order=10  where key='site.brand_vi';
update family.settings set field_type='text',  sort_order=11  where key='site.brand_en';
update family.settings set field_type='text',  sort_order=20  where key='site.surname';
update family.settings set field_type='text',  sort_order=21  where key='site.monogram';
update family.settings set field_type='number',sort_order=22  where key='site.established';
update family.settings set field_type='text',  sort_order=30  where key='site.hometown';
update family.settings set field_type='text',  sort_order=31  where key='site.hometown_en';
update family.settings set field_type='text',  sort_order=40  where key='site.motto';
update family.settings set field_type='text',  sort_order=41  where key='site.motto_en';

update family.settings set field_type='text',    sort_order=10 where key='contact.admin_email';
update family.settings set field_type='text',    sort_order=11 where key='contact.admin_phone';
update family.settings set field_type='url',     sort_order=20 where key='contact.public_url';

update family.settings set field_type='password',sort_order=10 where key='integrations.google_maps_api_key';

update family.settings set field_type='select:classic,scroll,modern',
                          sort_order=10 where key='appearance.default_theme';

-- ─── Seed new settings ─────────────────────────────────────────────────

insert into family.settings (key, value, category, description, field_type, sort_order) values
  -- ── Site (visual identity additions) ────────────────────────────
  ('site.tagline_vi',     'Một mái nhà — bốn phương con cháu',
    'site', 'Slogan ngắn dưới brand (tùy chọn)',
    'text', 50),
  ('site.tagline_en',     'One home — branches scattered across the land',
    'site', 'Slogan (English)',
    'text', 51),
  ('site.favicon_url',    '/favicon.svg',
    'site', 'URL favicon — thay nếu muốn dùng logo riêng',
    'url', 60),

  -- ── Contact (extras) ────────────────────────────────────────────
  ('contact.notify_emails', '',
    'contact', 'CSV email phụ nhận thông báo (đăng ký mới, ngày giỗ sắp tới...)',
    'text', 30),

  -- ── Social links ────────────────────────────────────────────────
  ('social.facebook_url', '',
    'social', 'Link group / page Facebook gia đình',
    'url', 10),
  ('social.youtube_url',  '',
    'social', 'Link kênh YouTube gia đình',
    'url', 20),
  ('social.zalo_oa',      '',
    'social', 'Zalo Official Account (số ID hoặc link mời)',
    'text', 30),
  ('social.instagram_url','',
    'social', 'Link Instagram gia đình',
    'url', 40),

  -- ── SEO & sharing ───────────────────────────────────────────────
  ('seo.indexing_enabled', 'false',
    'seo', 'Cho phép search engine index trang công khai. Mặc định TẮT (private genealogy site).',
    'boolean', 10),
  ('seo.default_description', 'Cây gia phả họ Nguyễn — Tịnh Khê. Lưu giữ ký ức gia đình bằng ảnh, mốc thời gian, và chuyện kể.',
    'seo', 'Meta description dùng khi page không tự khai báo',
    'textarea', 20),
  ('seo.og_image_url',     '',
    'seo', 'Ảnh share Facebook / Zalo (khuyến nghị 1200×630). Để trống = không gắn og:image.',
    'url', 30),
  ('seo.twitter_handle',   '',
    'seo', 'Twitter / X handle (kể cả ký tự @) cho og:twitter:site',
    'text', 40),

  -- ── Maps defaults (Vietnam-centered by default) ─────────────────
  ('maps.default_lat',   '15.1213',
    'maps', 'Vĩ độ trung tâm bản đồ mặc định (mặc định Tịnh Khê)',
    'number', 10),
  ('maps.default_lng',   '108.8044',
    'maps', 'Kinh độ trung tâm bản đồ mặc định',
    'number', 11),
  ('maps.default_zoom',  '6',
    'maps', 'Mức zoom mặc định (1-21). 6 = nhìn cả Việt Nam, 12 = thành phố, 16 = phố',
    'number', 12),

  -- ── Hero / slideshow defaults ───────────────────────────────────
  ('hero.default_duration_ms', '6000',
    'hero', 'Thời lượng mặc định cho slide ảnh mới (ms). Slide video tự dùng độ dài clip.',
    'number', 10),
  ('hero.show_lotus_when_empty', 'true',
    'hero', 'Khi không có slide active, hiện hero mặc định (sen + monogram) thay vì bỏ trống',
    'boolean', 20),
  ('hero.height', '70vh',
    'hero', 'Chiều cao khu hero (vd: 70vh, 100vh, 600px)',
    'text', 30),

  -- ── Privacy toggles ─────────────────────────────────────────────
  ('privacy.show_admin_link_in_footer', 'true',
    'privacy', 'Hiện link "Admin" trong footer trang công khai',
    'boolean', 10),
  ('privacy.show_theme_switcher', 'true',
    'privacy', 'Hiện nút đổi giao diện (classic / scroll / modern) trên header',
    'boolean', 20),
  ('privacy.lunar_calendar_first', 'false',
    'privacy', 'Ưu tiên hiển thị âm lịch lên trước dương lịch ở các ngày kỷ niệm',
    'boolean', 30),

  -- ── Analytics ───────────────────────────────────────────────────
  ('analytics.umami_url',      '',
    'analytics', 'URL self-hosted Umami (vd: https://umami.example.com/script.js)',
    'url', 10),
  ('analytics.umami_site_id',  '',
    'analytics', 'Umami website ID (UUID)',
    'text', 11),
  ('analytics.plausible_domain', '',
    'analytics', 'Plausible domain (vd: family.huynhvantuan.net) — bỏ trống nếu không dùng',
    'text', 20),
  ('analytics.google_tag_id',   '',
    'analytics', 'Google Analytics tag ID (G-XXXXXXX) — bỏ trống nếu không dùng',
    'text', 30),

  -- ── SMTP (for future notify-on-X email features) ────────────────
  ('smtp.host',     '',
    'smtp', 'SMTP host (vd: smtp.gmail.com). Bỏ trống = không gửi email',
    'text', 10),
  ('smtp.port',     '587',
    'smtp', 'SMTP port (587 STARTTLS, 465 SSL)',
    'number', 11),
  ('smtp.user',     '',
    'smtp', 'SMTP username',
    'text', 12),
  ('smtp.password', '',
    'smtp', 'SMTP password / app password',
    'password', 13),
  ('smtp.from_email', '',
    'smtp', 'Địa chỉ "From" hiển thị (vd: gia-pha@huynhvantuan.net)',
    'text', 20)
on conflict (key) do nothing;
