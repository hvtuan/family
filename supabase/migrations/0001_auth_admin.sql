-- 0001_auth_admin.sql
-- Phase 2 admin: create the `family` schema and seed users/allowlist/audit.
-- All Phase 2 tables live in their own schema so this Supabase instance can
-- host other projects (project_x.*, etc.) without naming collisions.
-- Auth (auth.*) and Storage (storage.*) schemas remain shared.

create schema if not exists family;
comment on schema family is 'Family genealogy project (Phase 2 admin) — see DESIGN-PHASE-2-ADMIN.md.';

-- ─── app_users ───────────────────────────────────────────────────────────────
-- Mirrors auth.users 1:1 but adds family-app fields (role, branch, status).
create table if not exists family.app_users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text unique not null,
  display_name text,
  role text not null check (role in ('admin','editor','branch_editor')),
  branch text check (branch in ('noi','ngoai','both')),
  status text not null default 'pending'
    check (status in ('pending','approved','revoked')),
  approved_at timestamptz,
  last_login_at timestamptz,
  created_at timestamptz default now()
);

create index if not exists app_users_email_idx on family.app_users(email);
create index if not exists app_users_status_idx on family.app_users(status);

comment on table family.app_users is
  'Application-level user record (1:1 with auth.users) carrying role, branch scope, and approval status.';

-- ─── allowed_emails ──────────────────────────────────────────────────────────
-- Specific emails (NOT domains) pre-authorised to sign up to the family app.
create table if not exists family.allowed_emails (
  email text primary key,
  role text not null check (role in ('admin','editor','branch_editor')),
  branch text check (branch in ('noi','ngoai','both')),
  added_by uuid references family.app_users(id) on delete set null,
  added_at timestamptz default now()
);

comment on table family.allowed_emails is
  'Whitelist of editor emails for the family app. On signup, app_users.role/branch are populated from here.';

-- ─── audit_log ───────────────────────────────────────────────────────────────
create table if not exists family.audit_log (
  id bigserial primary key,
  actor_id uuid references family.app_users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  diff jsonb,
  at timestamptz default now()
);

create index if not exists audit_log_actor_at_idx on family.audit_log(actor_id, at desc);
create index if not exists audit_log_entity_idx on family.audit_log(entity_type, entity_id);
create index if not exists audit_log_at_idx on family.audit_log(at desc);

comment on table family.audit_log is
  'Append-only log of every CRUD operation on family.* content tables and approval changes.';
