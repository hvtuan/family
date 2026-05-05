-- 0005_rls.sql
-- Row Level Security on every family.* table.
-- Service-role (used by migrations, build pipeline, server-side admin ops)
-- bypasses RLS automatically.

-- ─── content tables: select for any approved user; write per role ────────────

do $$
declare
  t text;
begin
  for t in select unnest(array[
    'members','timeline','traditions','photos','quotes','dates','locations'
  ]) loop
    execute format('alter table family.%I enable row level security', t);
    execute format('alter table family.%I force row level security', t);

    -- Drop existing policies (idempotent)
    execute format('drop policy if exists %I on family.%I', t || '_select', t);
    execute format('drop policy if exists %I on family.%I', t || '_write_full', t);
    execute format('drop policy if exists %I on family.%I', t || '_write_branch', t);

    execute format(
      'create policy %I on family.%I for select
         using (family.current_role() in (''admin'',''editor'',''branch_editor''))',
      t || '_select', t);

    execute format(
      'create policy %I on family.%I for all
         using (family.current_role() in (''admin'',''editor''))
         with check (family.current_role() in (''admin'',''editor''))',
      t || '_write_full', t);
  end loop;
end $$;

-- members: branch_editor write — only matching branch
create policy members_write_branch on family.members for all
  using (family.current_role() = 'branch_editor' and branch = family.current_branch())
  with check (family.current_role() = 'branch_editor' and branch = family.current_branch());

-- For non-member content, branch_editor can write all (not branch-scoped).
do $$
declare
  t text;
begin
  for t in select unnest(array[
    'timeline','traditions','photos','quotes','dates','locations'
  ]) loop
    execute format(
      'create policy %I on family.%I for all
         using (family.current_role() = ''branch_editor'')
         with check (family.current_role() = ''branch_editor'')',
      t || '_write_branch', t);
  end loop;
end $$;

-- ─── M2M tables: same access as parent (admin/editor + branch_editor) ────────
do $$
declare
  t text;
begin
  for t in select unnest(array[
    'member_children','timeline_members','photo_members','location_members'
  ]) loop
    execute format('alter table family.%I enable row level security', t);
    execute format('alter table family.%I force row level security', t);

    execute format('drop policy if exists %I on family.%I', t || '_select', t);
    execute format('drop policy if exists %I on family.%I', t || '_write', t);

    execute format(
      'create policy %I on family.%I for select
         using (family.current_role() in (''admin'',''editor'',''branch_editor''))',
      t || '_select', t);

    execute format(
      'create policy %I on family.%I for all
         using (family.current_role() in (''admin'',''editor'',''branch_editor''))
         with check (family.current_role() in (''admin'',''editor'',''branch_editor''))',
      t || '_write', t);
  end loop;
end $$;

-- ─── app_users: self-read + admin-write ──────────────────────────────────────
alter table family.app_users enable row level security;
alter table family.app_users force row level security;

drop policy if exists app_users_self_read on family.app_users;
drop policy if exists app_users_admin_write on family.app_users;

create policy app_users_self_read on family.app_users for select
  using (auth.uid() = id or family.is_admin());

create policy app_users_admin_write on family.app_users for all
  using (family.is_admin())
  with check (family.is_admin());

-- ─── allowed_emails: admin only ──────────────────────────────────────────────
alter table family.allowed_emails enable row level security;
alter table family.allowed_emails force row level security;

drop policy if exists allowed_emails_admin on family.allowed_emails;

create policy allowed_emails_admin on family.allowed_emails for all
  using (family.is_admin())
  with check (family.is_admin());

-- ─── audit_log: admin read; INSERT happens via SECURITY DEFINER trigger ─────
alter table family.audit_log enable row level security;
alter table family.audit_log force row level security;

drop policy if exists audit_log_admin_read on family.audit_log;

create policy audit_log_admin_read on family.audit_log for select
  using (family.is_admin());

-- ─── Grant authenticated role usage on family schema ────────────────────────
-- PostgREST exposes schemas listed in PGRST_DB_SCHEMAS to API clients. Even
-- so, the `authenticated` and `anon` roles need USAGE on the schema before
-- they can SELECT/INSERT through the API. RLS policies still gate row access.
grant usage on schema family to anon, authenticated;
grant select, insert, update, delete on all tables in schema family to authenticated;
grant select on all tables in schema family to anon;
grant usage, select on all sequences in schema family to authenticated;
grant execute on all functions in schema family to anon, authenticated;

alter default privileges in schema family
  grant select, insert, update, delete on tables to authenticated;
alter default privileges in schema family
  grant select on tables to anon;
alter default privileges in schema family
  grant execute on functions to anon, authenticated;
