-- 0016_themes.sql
--
-- Admin-managed visual themes. Each theme is a named palette of CSS
-- variable overrides applied via [data-theme="X"] on <html>. The
-- public site switches based on the row marked is_default=true; there
-- is no user-side theme picker anymore — admin controls the look.
--
-- The vars JSONB stores only OVERRIDES vs the base @theme block in
-- global.css. Common keys (no need to set all):
--   color-ink, color-ink-2, color-ink-3
--   color-paper, color-paper-2, color-paper-3, color-cream
--   color-gold, color-gold-2, color-gold-3
--   color-vermilion, color-vermilion-2
--   color-jade, color-jade-2
--   color-line, color-line-strong

create table if not exists family.themes (
  id           text primary key,
  label_vi     text not null,
  label_en     text not null,
  swatch       text not null,                              -- hex color shown in admin lists
  vars         jsonb not null default '{}'::jsonb,
  is_default   boolean not null default false,
  sort_order   int not null default 100,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  updated_by   uuid references family.app_users(id) on delete set null,

  constraint themes_id_format check (id ~ '^[a-z][a-z0-9-]{0,30}$')
);

-- Exactly one default at a time. Partial unique index.
create unique index if not exists themes_one_default_idx
  on family.themes((1)) where is_default = true;

drop trigger if exists themes_set_updated_at on family.themes;
create trigger themes_set_updated_at
  before update on family.themes
  for each row execute function family.set_updated_at();

drop trigger if exists themes_audit on family.themes;
create trigger themes_audit
  after insert or update or delete on family.themes
  for each row execute function family.log_audit();

grant all on family.themes to service_role, postgres;

-- ─── Seed the three current themes ─────────────────────────────────
insert into family.themes (id, label_vi, label_en, swatch, vars, is_default, sort_order) values
  ('classic',
    'Cổ điển', 'Classic', '#f5ecd7',
    '{
      "color-ink": "#1a120a",
      "color-ink-2": "#3a2a1a",
      "color-ink-3": "#5c4a33",
      "color-paper": "#f5ecd7",
      "color-paper-2": "#efe4c7",
      "color-paper-3": "#e6d9b3",
      "color-cream": "#faf3e0",
      "color-gold": "#c9a35a",
      "color-gold-2": "#a8853f",
      "color-gold-3": "#e6c885",
      "color-vermilion": "#8b2a1f",
      "color-vermilion-2": "#6b1f17",
      "color-jade": "#2f4a3a",
      "color-jade-2": "#466b54",
      "color-line": "rgba(26, 18, 10, 0.12)",
      "color-line-strong": "rgba(26, 18, 10, 0.25)"
    }'::jsonb,
    true, 10),

  ('scroll',
    'Cuộn giấy', 'Scroll', '#efe0c1',
    '{
      "color-paper": "#efe0c1",
      "color-paper-2": "#e5d3af",
      "color-paper-3": "#d9c497",
      "color-cream": "#f7ebcf",
      "color-ink": "#2c1c0a",
      "color-ink-2": "#4a2e14",
      "color-vermilion": "#9a2a20",
      "color-gold": "#b88a3d",
      "color-gold-2": "#8e6420"
    }'::jsonb,
    false, 20),

  ('modern',
    'Hiện đại', 'Modern', '#f4f1e8',
    '{
      "color-paper": "#f4f1e8",
      "color-paper-2": "#eae6d9",
      "color-paper-3": "#ddd8c8",
      "color-cream": "#ffffff",
      "color-ink": "#151311",
      "color-ink-2": "#2a2520",
      "color-ink-3": "#60574c",
      "color-gold": "#9a7d3a",
      "color-gold-2": "#6e5820",
      "color-vermilion": "#6b1f17"
    }'::jsonb,
    false, 30)
on conflict (id) do nothing;

-- The "Hiện nút đổi giao diện" toggle no longer applies — the public
-- switcher is gone, themes are admin-controlled. Remove the row so it
-- stops cluttering /admin/settings.
delete from family.settings where key = 'privacy.show_theme_switcher';

-- appearance.default_theme will now hold the slug of a row in
-- family.themes, not a fixed enum. Update the description to match.
update family.settings
   set description = 'Theme mặc định cho khách. Chỉ chấp nhận id theme đã tạo trong /admin/themes.',
       field_type = 'text'
 where key = 'appearance.default_theme';
