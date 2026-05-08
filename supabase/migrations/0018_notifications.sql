-- 0018_notifications.sql
--
-- Multi-channel notification system. See DESIGN-NOTIFICATIONS.md.
--
-- Adds:
--   1. notifications (queue + log)
--   2. web_push_subscriptions (VAPID per device per user)
--   3. notification_link_tokens (chat-channel deep-link / OAuth)
--   4. app_users extensions (avatar_url, timezone, notification_preferences)
--   5. settings keys for VAPID + chat-channel tokens

-- ── 1. notifications ─────────────────────────────────────────────
create table if not exists family.notifications (
  id                  bigserial primary key,
  user_id             uuid not null references family.app_users(id) on delete cascade,
  event_type          text not null,
  payload             jsonb not null default '{}'::jsonb,
  status              text not null default 'pending'
                       check (status in ('pending','sending','sent','partial','failed','seen')),
  channels_requested  text[] not null default '{}',
  channels_delivered  text[] not null default '{}',
  channels_failed     text[] not null default '{}',
  attempt_count       integer not null default 0,
  last_error          text,
  next_retry_at       timestamptz,
  created_at          timestamptz not null default now(),
  sent_at             timestamptz,
  seen_at             timestamptz
);
create index if not exists notif_user_unseen_idx on family.notifications (user_id, seen_at)
  where seen_at is null;
create index if not exists notif_status_retry_idx on family.notifications (status, next_retry_at)
  where status in ('pending','partial','failed');
create index if not exists notif_user_recent_idx on family.notifications (user_id, created_at desc);

comment on table family.notifications is
  'Multi-channel notification queue + log. Single source of truth: status drives delivery state across attempt cycles.';

-- ── 2. web_push_subscriptions ────────────────────────────────────
create table if not exists family.web_push_subscriptions (
  id          bigserial primary key,
  user_id     uuid not null references family.app_users(id) on delete cascade,
  endpoint    text not null unique,
  p256dh      text not null,
  auth        text not null,
  user_agent  text,
  created_at  timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index if not exists push_user_idx on family.web_push_subscriptions (user_id);

-- ── 3. notification_link_tokens ──────────────────────────────────
create table if not exists family.notification_link_tokens (
  token       text primary key,
  user_id     uuid not null references family.app_users(id) on delete cascade,
  channel_id  text not null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null default (now() + interval '10 minutes'),
  consumed_at timestamptz
);
create index if not exists link_token_user_channel_idx on family.notification_link_tokens (user_id, channel_id);

-- ── 4. app_users extensions ──────────────────────────────────────
alter table family.app_users
  add column if not exists avatar_url text,
  add column if not exists timezone text default 'Asia/Ho_Chi_Minh',
  add column if not exists notification_preferences jsonb
    not null default '{
      "channels": {
        "email":     { "enabled": true },
        "in_app":    { "enabled": true },
        "web_push":  { "enabled": false },
        "zalo":      { "enabled": false, "user_id": null, "phone": null },
        "telegram":  { "enabled": false, "chat_id": null, "username": null },
        "messenger": { "enabled": false, "psid": null },
        "whatsapp":  { "enabled": false, "phone": null },
        "sms":       { "enabled": false, "phone": null }
      },
      "events": {
        "anniversary.t-7":    ["email","in_app"],
        "anniversary.t-1":    ["email","in_app","web_push","zalo"],
        "anniversary.today":  ["email","in_app","web_push","zalo"],
        "condolence.pending": ["in_app"],
        "member.added":       ["in_app"],
        "system.welcome":     ["email","in_app"]
      },
      "quiet_hours": { "enabled": false, "from": "22:00", "to": "07:00" }
    }'::jsonb;

create index if not exists app_users_pref_gin_idx on family.app_users using gin (notification_preferences);

-- ── 5. settings keys ─────────────────────────────────────────────
insert into family.settings (key, value, category, description, field_type, sort_order) values
  ('notifications.enable',                 'true', 'memorial', 'Master switch toàn hệ thống thông báo', 'boolean', 100),
  ('notifications.retention_days',         '90',   'memorial', 'Số ngày giữ thông báo trước khi tự xoá', 'number', 110),
  ('notifications.web_push_vapid_public',  '',     'memorial', 'VAPID public key (admin generate qua pnpm run notif:gen-vapid)', 'text', 120),
  ('notifications.web_push_vapid_private', '',     'memorial', 'VAPID private key', 'password', 121),
  ('notifications.zalo_oa_token',          '',     'memorial', 'Zalo OA access token (Phase 2)', 'password', 130),
  ('notifications.zalo_oa_id',             '',     'memorial', 'Zalo OA ID (Phase 2)', 'text', 131),
  ('notifications.telegram_bot_token',     '',     'memorial', 'Telegram bot token (Phase 2)', 'password', 140),
  ('notifications.telegram_bot_username',  '',     'memorial', 'Telegram bot @username (Phase 2)', 'text', 141),
  ('notifications.messenger_page_token',   '',     'memorial', 'FB Messenger Page Access Token (Phase 3)', 'password', 150),
  ('notifications.messenger_page_id',      '',     'memorial', 'FB Messenger Page ID (Phase 3)', 'text', 151),
  ('notifications.whatsapp_token',         '',     'memorial', 'WhatsApp Business token (Phase 3)', 'password', 160),
  ('notifications.whatsapp_phone_id',      '',     'memorial', 'WhatsApp phone number ID (Phase 3)', 'text', 161),
  ('notifications.sms_provider',           'none', 'memorial', 'SMS provider', 'select:none,esms,twilio', 170),
  ('notifications.sms_api_key',            '',     'memorial', 'SMS API key (Phase 3)', 'password', 171)
on conflict (key) do nothing;
