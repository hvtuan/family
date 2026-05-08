-- 0019_notification_webhook_secrets.sql
--
-- Per-channel webhook verification secrets (Phase 2 chat channels).

insert into family.settings (key, value, category, description, field_type, sort_order) values
  ('notifications.telegram_webhook_secret', '', 'memorial',
   'Telegram setWebhook secret_token — random ≥32-char string sent back as X-Telegram-Bot-Api-Secret-Token header',
   'password', 142),
  ('notifications.zalo_webhook_secret', '', 'memorial',
   'Zalo OA webhook signing secret (Phase 2)',
   'password', 132)
on conflict (key) do nothing;
