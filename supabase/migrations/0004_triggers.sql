-- 0004_triggers.sql
-- Apply set_updated_at + log_audit to every family.* content table.
-- Auth tables (family.app_users, family.allowed_emails) get only updated_at —
-- auditing them via the same trigger could cause recursion since log_audit
-- reads app_users for the actor.

-- ─── set_updated_at triggers on content ──────────────────────────────────────
do $$
declare
  t text;
begin
  for t in select unnest(array[
    'members','timeline','traditions','photos','quotes','dates','locations'
  ]) loop
    execute format(
      'drop trigger if exists %I on family.%I',
      t || '_set_updated_at', t);
    execute format(
      'create trigger %I before update on family.%I
         for each row execute function family.set_updated_at()',
      t || '_set_updated_at', t);
  end loop;
end $$;

-- ─── audit_log triggers on content ───────────────────────────────────────────
do $$
declare
  t text;
begin
  for t in select unnest(array[
    'members','timeline','traditions','photos','quotes','dates','locations'
  ]) loop
    execute format(
      'drop trigger if exists %I on family.%I',
      t || '_audit', t);
    execute format(
      'create trigger %I after insert or update or delete on family.%I
         for each row execute function family.log_audit()',
      t || '_audit', t);
  end loop;
end $$;

-- ─── auth.users → family.app_users provisioning ──────────────────────────────
-- Trigger name prefixed with `family_` so other projects can install their
-- own `<project>_on_auth_user_created` trigger on auth.users without clashing.
drop trigger if exists family_on_auth_user_created on auth.users;
create trigger family_on_auth_user_created
  after insert on auth.users
  for each row execute function family.handle_new_user();
