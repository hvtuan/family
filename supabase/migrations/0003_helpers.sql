-- 0003_helpers.sql
-- Helper functions used by RLS policies, triggers, and audit log.
-- All in family schema so other projects can have their own analogues.

-- ─── current_role / current_branch / is_admin ────────────────────────────────
-- SECURITY DEFINER so they can read family.app_users without recursive RLS.
-- search_path locked to family+auth+public to prevent search_path hijack.

create or replace function family.current_role() returns text
  language sql stable security definer
  set search_path = family, auth, public
as $$
  select role
  from family.app_users
  where id = auth.uid()
    and status = 'approved'
$$;

create or replace function family.current_branch() returns text
  language sql stable security definer
  set search_path = family, auth, public
as $$
  select branch
  from family.app_users
  where id = auth.uid()
    and status = 'approved'
$$;

create or replace function family.is_admin() returns boolean
  language sql stable security definer
  set search_path = family, auth, public
as $$
  select coalesce(
    (select role = 'admin'
     from family.app_users
     where id = auth.uid() and status = 'approved'),
    false)
$$;

-- ─── set_updated_at trigger function ─────────────────────────────────────────
create or replace function family.set_updated_at() returns trigger
  language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ─── log_audit trigger function ──────────────────────────────────────────────
create or replace function family.log_audit() returns trigger
  language plpgsql
  security definer
  set search_path = family, auth, public
as $$
declare
  v_diff jsonb;
  v_entity_id text;
begin
  if tg_op = 'INSERT' then
    v_diff = to_jsonb(new);
    v_entity_id = (to_jsonb(new) ->> 'id');
  elsif tg_op = 'UPDATE' then
    v_diff = jsonb_build_object('before', to_jsonb(old), 'after', to_jsonb(new));
    v_entity_id = (to_jsonb(new) ->> 'id');
  elsif tg_op = 'DELETE' then
    v_diff = to_jsonb(old);
    v_entity_id = (to_jsonb(old) ->> 'id');
  end if;

  insert into family.audit_log (actor_id, action, entity_type, entity_id, diff)
  values (
    auth.uid(),
    lower(tg_op),
    tg_table_name,
    v_entity_id,
    v_diff
  );

  return coalesce(new, old);
end;
$$;

-- ─── handle_new_user — auto-create family.app_users row on auth.users insert ─
-- Per-project trigger: only acts if email is in family.allowed_emails.
-- Other projects (project_x.handle_new_user) will have their own triggers
-- and check their own allowlists; multiple triggers on auth.users are fine.
create or replace function family.handle_new_user() returns trigger
  language plpgsql
  security definer
  set search_path = family, auth, public
as $$
declare
  v_allow record;
begin
  select role, branch into v_allow
  from family.allowed_emails
  where email = new.email;

  if found then
    insert into family.app_users (id, email, display_name, role, branch, status, approved_at)
    values (
      new.id,
      new.email,
      coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
      v_allow.role,
      v_allow.branch,
      'approved',
      now()
    )
    on conflict (id) do nothing;
  else
    -- Email not whitelisted for family. We still create a 'pending' row so an
    -- admin can review and (if appropriate) approve via /admin/users. Other
    -- projects' triggers see the same auth.users insert and may also create
    -- pending rows in their own schemas — that's expected.
    insert into family.app_users (id, email, display_name, role, branch, status)
    values (
      new.id,
      new.email,
      coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)),
      'editor',
      'both',
      'pending'
    )
    on conflict (id) do nothing;
  end if;

  return new;
end;
$$;
