-- 0020_notifications_category.sql
--
-- Move notifications.* settings keys out of the "memorial" category into a
-- dedicated "notifications" category. Keeps the memorial.* keys (memorial.enable,
-- memorial.banner_days_before, etc.) where they were. Lets admins find the
-- master switch + channel tokens under a clearer label.

alter table family.settings drop constraint if exists settings_category_check;
alter table family.settings add constraint settings_category_check
  check (category in (
    'site', 'contact', 'integrations', 'appearance',
    'seo', 'maps', 'privacy', 'social', 'analytics', 'smtp', 'hero',
    'memorial', 'notifications'
  ));

update family.settings
  set category = 'notifications'
  where key like 'notifications.%';
