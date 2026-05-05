# DESIGN — Phase 2 Custom Admin (Family Project)

> **Status**: Active design (2026-05-05). Supersedes `PHASE-2-ADMIN.md` (Sveltia plan, deprecated).
> **Owner**: solo dev (user).
> **Estimate**: ~14 dev-days across 11 phases (P0–P10).

---

## 1. Understanding Lock (confirmed)

### Summary

- **What**: Build custom admin web app at `/admin` (same domain, `family.huynhvantuan.net`) so 5–10 non-technical family members can edit content (members, timeline, traditions, photos, quotes, dates, locations) via Vietnamese mobile-first UI without touching git or code.
- **Why**: Sveltia/Decap CMS does not natively support SSO + admin approval + granular permissions. Path B (custom build with Supabase + TailAdmin patterns) trades higher dev effort for full control over auth UX, role-based permissions, and Vietnamese-first interface — all required by the audience (cô chú lớn tuổi).
- **Who**:
  - **Editors**: ~5–10 family members, non-tech, mobile-first, login via Google SSO or email magic-link.
  - **Admin**: solo dev (user) approves new signups + assigns role/branch.
- **Scope shift from Phase 1**:
  - Migrate content from `src/content/**/*.{md,yaml}` → Supabase Postgres (one-time).
  - Public site remains static (rebuild webhook on save) → Lighthouse ≥95 preserved.
  - Astro mode: static-only → **hybrid** (Node adapter) so `/admin/**` runs SSR while public pages stay prerendered.
- **Constraints**: Tailwind v4, React 19, Astro 6 (existing). Supabase free tier. Coolify single VPS. UI tiếng Việt 100%, mobile-first, WCAG AA.
- **Non-goals**: design/layout editor, multi-tenant, real-time collab, PDF export, browser legacy support.

### Final Decisions (8 confirmed in brainstorm)

| # | Decision | Choice |
|---|---|---|
| 1 | Data persistence | **Y** — Supabase Postgres source of truth |
| 2 | Auth providers | **A** — Google SSO + email magic link |
| 3 | Roles | **B** — `admin` / `editor` / `branch_editor` |
| 4 | Approval | **B (modified)** — email whitelist (specific emails) |
| 5 | Public render | **static** — rebuild webhook on save |
| 6 | Image upload | **A** — Supabase Storage CDN |
| 7 | UI base | **A** — port 8 TailAdmin components |
| 8 | Editorial flow | **A** — direct save, role-based guardrail |

### Assumptions

1. User manages Supabase project (account, billing, DNS).
2. Existing 7 Zod schemas map 1:1 to Postgres tables; relations via FK; bilingual fields (`*Vi` / `*En`) become columns.
3. New field `members.branch` enum `'noi' | 'ngoai' | 'both'`, default `'both'`, user backfills manually.
4. Photos: existing SVG samples stay in git; admin uploads new images to Supabase Storage.
5. No GitHub bot token needed (DB-as-CMS).
6. Coolify rebuild via Supabase Database Webhook → POST GHA `workflow_dispatch`.
7. Astro hybrid + `@astrojs/node` adapter, single Node container replaces nginx static.
8. RLS policies enforce permissions server-side; client uses anon key + auth session cookies.
9. Free tier Supabase suffices (5–10 MAU, ~500 members, ~2K photos).
10. Default UI Vietnamese; English fallback labels exist but secondary.

### Open Questions (all defaulted)

1. Supabase managed (`*.supabase.co`) → **default yes** (no self-host ops).
2. Email whitelist initial seed → **default**: empty table, user adds via `/admin/allowed-emails` after deploy.
3. Astro hybrid migration risk → **mitigation**: spike on `phase2-spike` branch (P0).
4. Image migration for real photos → **default**: CLI batch seed script when user has them.
5. Audit log retention → **default**: forever (data small).
6. Backup → **default**: Supabase native daily backup (free tier 7d) is enough.

### Risks Acknowledged

- **R1**: Supabase lock-in. *Mitigate*: standard Postgres, dump/restore portable.
- **R2**: Astro hybrid + Node adapter not yet tested on Coolify. *Mitigate*: P0 spike on isolated branch.
- **R3**: Migration script edge cases (lunar dates, optional fields). *Mitigate*: dry-run + diff review.
- **R4**: TailAdmin license. *Mitigate*: TailAdmin Free is MIT — confirm before port.
- **R5**: Mobile UX untested. *Mitigate*: P10 soft launch with 1–2 cô chú first.
- **R6**: 50K MAU free tier — comfortably below for 5–10 editors.

---

## 2. Architecture

### System diagram

```
┌─────────────────────┐         ┌──────────────────────────────┐
│ Editor (cô chú)     │         │ Admin (user)                 │
│ Mobile/desktop      │         │ Desktop                      │
└──────────┬──────────┘         └──────────────┬───────────────┘
           │                                   │
           │   Google SSO / magic link         │
           │                                   │
           ▼                                   ▼
┌──────────────────────────────────────────────────────────────┐
│ family.huynhvantuan.net  (Astro hybrid, Node adapter)        │
│                                                              │
│  /             ──── static (prerendered)                     │
│  /members      ──── static                                   │
│  /timeline     ──── static                                   │
│  /album        ──── static                                   │
│  ... (9 public routes)                                       │
│                                                              │
│  /admin        ──── SSR — TailAdmin shell + React forms      │
│  /admin/api/*  ──── SSR endpoints (CRUD, upload, approve)    │
└─────────────┬────────────────────────────────┬───────────────┘
              │                                │
              │  @supabase/ssr                 │  Image upload
              ▼                                ▼
┌──────────────────────────┐         ┌────────────────────────┐
│ Supabase Postgres        │         │ Supabase Storage       │
│  - app_users             │         │  bucket: photos        │
│  - allowed_emails        │         │  (public read CDN)     │
│  - audit_log             │         └────────────────────────┘
│  - members, timeline,    │
│    traditions, photos,   │
│    quotes, dates,        │
│    locations             │
│  + RLS policies          │
└──────────┬───────────────┘
           │  Database Webhook (after_insert/update/delete on content tables)
           ▼
┌──────────────────────────┐         ┌────────────────────────┐
│ GitHub Actions           │ ───────►│ Coolify rebuild        │
│ workflow_dispatch        │         │ → static prerender     │
└──────────────────────────┘         └────────────────────────┘
```

### Tech stack additions

| Layer | Package | Purpose |
|---|---|---|
| Astro adapter | `@astrojs/node` | SSR runtime |
| Supabase client | `@supabase/supabase-js` | Browser + server queries |
| Supabase SSR | `@supabase/ssr` | Cookie-based auth in Astro/React |
| Forms | `react-hook-form` + `@hookform/resolvers/zod` | Reuse existing Zod schemas |
| Email | `resend` (via Edge Function) | Notify on signup/approval |
| Existing | Tailwind v4, React 19, Radix UI, nanostores, Zod, Embla, lucide-react | Reused |

---

## 3. Database Schema

### Auth + admin tables

```sql
-- Whitelist of emails allowed to signup
create table allowed_emails (
  email text primary key,
  role text not null check (role in ('admin','editor','branch_editor')),
  branch text check (branch in ('noi','ngoai','both')),
  added_by uuid references app_users(id),
  added_at timestamptz default now()
);

-- App-level user record (linked to auth.users)
create table app_users (
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

-- Audit log
create table audit_log (
  id bigserial primary key,
  actor_id uuid references app_users(id),
  action text not null,        -- 'create','update','delete','approve','revoke'
  entity_type text not null,   -- 'member','timeline','photo',...
  entity_id text,
  diff jsonb,
  at timestamptz default now()
);

create index audit_log_actor_at on audit_log(actor_id, at desc);
create index audit_log_entity on audit_log(entity_type, entity_id);
```

### Content tables (mirror Zod schemas, snake_case)

```sql
create table members (
  id text primary key,                    -- e.g. 'g3-2'
  name text not null,
  name_en text,
  gen smallint not null check (gen between 1 and 8),
  role text,
  role_en text,
  birth_order smallint,
  is_family_head boolean default false,
  born text,                              -- 'YYYY-MM-DD' or partial
  lunar_born text,
  birth_place text,
  died text,
  lunar_died text,
  death_place text,
  gravesite text,
  zodiac text,
  elemental_sign text,
  bio text,
  bio_en text,
  body_md text,                            -- full markdown body
  location text,
  job text,
  job_en text,
  hobbies jsonb default '[]'::jsonb,
  religion text,
  father_id text references members(id) on delete set null,
  mother_id text references members(id) on delete set null,
  spouse_id text references members(id) on delete set null,
  quote text,
  achievements jsonb default '[]'::jsonb,  -- [{title, year}]
  anecdotes jsonb default '[]'::jsonb,     -- [{title, body}]
  pattern text check (pattern in ('hatch','dots','lines','bamboo','glow')),
  branch text not null default 'both' check (branch in ('noi','ngoai','both')),
  contact_public boolean default false,
  phone text,
  email text,
  address text,
  status text not null default 'published' check (status in ('draft','published')),
  tags jsonb default '[]'::jsonb,
  updated_at_user timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  created_by uuid references app_users(id),
  updated_by uuid references app_users(id)
);

-- M2M: explicit children (in addition to parent FKs for ordering / lookups)
create table member_children (
  parent_id text references members(id) on delete cascade,
  child_id text references members(id) on delete cascade,
  primary key (parent_id, child_id)
);

create index members_gen on members(gen);
create index members_branch on members(branch);
create index members_status on members(status);

create table timeline (
  id bigserial primary key,
  year int not null,
  date text,
  lunar boolean default false,
  title text not null,
  title_en text,
  desc_text text,
  desc_en text,
  category text check (category in
    ('founding','birth','marriage','death','milestone','gathering')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  created_by uuid references app_users(id),
  updated_by uuid references app_users(id)
);

create table timeline_members (
  timeline_id bigint references timeline(id) on delete cascade,
  member_id text references members(id) on delete cascade,
  primary key (timeline_id, member_id)
);

create index timeline_year on timeline(year);

create table traditions (
  id text primary key,
  name text not null,
  name_en text,
  category text default 'food' check (category in ('food','festival','ceremony','craft')),
  icon text check (icon in ('bowl','fish','leaf','shell','incense','blossom')),
  desc_text text,
  desc_en text,
  origin text,
  body_md text,
  tags jsonb default '[]'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  created_by uuid references app_users(id),
  updated_by uuid references app_users(id)
);

create table photos (
  id text primary key,
  src text not null,                       -- Supabase Storage URL
  caption text,
  caption_en text,
  year int,
  date text,
  location text,
  album text,
  featured boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  created_by uuid references app_users(id),
  updated_by uuid references app_users(id)
);

create table photo_members (
  photo_id text references photos(id) on delete cascade,
  member_id text references members(id) on delete cascade,
  primary key (photo_id, member_id)
);

create index photos_year on photos(year);
create index photos_featured on photos(featured) where featured = true;

create table quotes (
  id bigserial primary key,
  text text not null,
  text_en text,
  author text not null,
  author_ref text references members(id) on delete set null,
  type text default 'family' check (type in ('proverb','family','poem','letter')),
  context text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  created_by uuid references app_users(id),
  updated_by uuid references app_users(id)
);

create table dates (
  id bigserial primary key,
  date text not null,                      -- 'MM-DD' or 'YYYY-MM-DD'
  calendar text default 'solar' check (calendar in ('lunar','solar')),
  name text not null,
  name_en text,
  type text not null check (type in
    ('memorial','festival','birthday','national','anniversary','gathering')),
  member_id text references members(id) on delete set null,
  year int,
  recurring boolean default true,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  created_by uuid references app_users(id),
  updated_by uuid references app_users(id)
);

create index dates_calendar_date on dates(calendar, date);

create table locations (
  id text primary key,
  name text not null,
  name_en text,
  province text,
  lat double precision,
  lng double precision,
  is_hometown boolean default false,
  description text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  created_by uuid references app_users(id),
  updated_by uuid references app_users(id)
);

create table location_members (
  location_id text references locations(id) on delete cascade,
  member_id text references members(id) on delete cascade,
  primary key (location_id, member_id)
);
```

### Triggers

```sql
-- Auto-update updated_at on every UPDATE
create or replace function set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- Apply to each content table
create trigger members_updated before update on members
  for each row execute function set_updated_at();
-- (repeat for timeline, traditions, photos, quotes, dates, locations)

-- Audit log trigger
create or replace function log_audit() returns trigger language plpgsql as $$
declare
  v_diff jsonb;
begin
  if tg_op = 'INSERT' then
    v_diff = to_jsonb(new);
  elsif tg_op = 'UPDATE' then
    v_diff = jsonb_build_object('before', to_jsonb(old), 'after', to_jsonb(new));
  elsif tg_op = 'DELETE' then
    v_diff = to_jsonb(old);
  end if;

  insert into audit_log (actor_id, action, entity_type, entity_id, diff)
  values (
    auth.uid(),
    lower(tg_op),
    tg_table_name,
    coalesce((new.id)::text, (old.id)::text),
    v_diff
  );
  return coalesce(new, old);
end;
$$;

create trigger members_audit after insert or update or delete on members
  for each row execute function log_audit();
-- (repeat for the other 6 content tables)
```

---

## 4. Auth Flow + RLS Policies

### Login flow

```
1. /admin → not logged in → redirect /admin/login
2. /admin/login → "Đăng nhập với Google" OR "Nhập email"
3. Supabase Auth redirect → callback /admin/auth/callback
4. Server-side check email vs allowed_emails:
   - hit  → upsert app_users (status='approved' if auto-approve, role/branch from whitelist)
            → set session cookie → redirect /admin
   - miss → insert app_users(status='pending')
            → redirect /admin/pending
            → fire Resend email to admin "new signup, please review"
5. Admin /admin/users → approve → update status + role/branch → notify editor
6. Sessions: 1-week refresh-token rotation, secure http-only cookies
```

### RLS helper functions

```sql
create or replace function current_role() returns text
  language sql stable security definer
  set search_path = public, auth
as $$
  select role from app_users
  where id = auth.uid() and status = 'approved'
$$;

create or replace function current_branch() returns text
  language sql stable security definer
  set search_path = public, auth
as $$
  select branch from app_users
  where id = auth.uid() and status = 'approved'
$$;

create or replace function is_admin() returns boolean
  language sql stable security definer
  set search_path = public, auth
as $$
  select coalesce(
    (select role = 'admin' from app_users
     where id = auth.uid() and status = 'approved'),
    false)
$$;
```

### Policies (sample for `members`; replicate for other content tables)

```sql
alter table members enable row level security;

-- READ: any approved user
create policy members_select on members for select
  using (current_role() in ('admin','editor','branch_editor'));

-- WRITE admin/editor: full
create policy members_write_full on members for all
  using (current_role() in ('admin','editor'))
  with check (current_role() in ('admin','editor'));

-- WRITE branch_editor: only matching branch
create policy members_write_branch on members for all
  using (current_role() = 'branch_editor' and branch = current_branch())
  with check (current_role() = 'branch_editor' and branch = current_branch());
```

### Admin-only tables

```sql
alter table app_users enable row level security;
alter table allowed_emails enable row level security;
alter table audit_log enable row level security;

create policy app_users_self_read on app_users for select
  using (auth.uid() = id or is_admin());
create policy app_users_admin_write on app_users for all
  using (is_admin()) with check (is_admin());

create policy allowed_emails_admin on allowed_emails for all
  using (is_admin()) with check (is_admin());

create policy audit_log_admin on audit_log for select
  using (is_admin());
```

---

## 5. Admin UI

### Route map

```
/admin                       Dashboard (counts, recent edits, pending approvals)
/admin/login                 Login (Google + magic link)
/admin/auth/callback         OAuth/magic-link callback
/admin/pending               "Chờ duyệt" placeholder
/admin/members               List + filters
/admin/members/new           Create
/admin/members/[id]          Edit (relations, photos tab)
/admin/timeline              List
/admin/timeline/new
/admin/timeline/[id]
/admin/traditions            (same pattern)
/admin/photos                Grid + upload
/admin/quotes
/admin/dates
/admin/locations
/admin/users                 [admin] approve + role
/admin/allowed-emails        [admin] whitelist CRUD
/admin/audit                 [admin] log viewer
/admin/settings              Profile, language toggle
/admin/api/*                 SSR endpoints
```

### Component tree

```
src/
  layouts/
    AdminLayout.astro
  pages/
    admin/                   (export const prerender = false)
      index.astro
      login.astro
      auth/callback.ts
      members/
        index.astro          → <MembersTable />
        new.astro            → <MemberForm mode="create" />
        [id].astro           → <MemberForm mode="edit" />
      ...
      api/
        members.ts
        timeline.ts
        upload.ts
        users/approve.ts
        ...
  components/admin/
    Sidebar.tsx              [TailAdmin port]
    Topbar.tsx               [TailAdmin port]
    DataTable.tsx            [TailAdmin port]
    FormField.tsx            [TailAdmin port]
    Breadcrumb.tsx           [TailAdmin port]
    Badge.tsx                [TailAdmin port]
    StatCard.tsx             [TailAdmin port]
    Modal.tsx                Radix Dialog + TailAdmin styling
    forms/
      MemberForm.tsx
      TimelineForm.tsx
      ...
  lib/
    supabase/
      client.ts              Browser client (anon key)
      server.ts              @supabase/ssr (cookies)
      admin.ts               Service role (server-only)
    schemas/                 Reused from src/content.config.ts
```

### TailAdmin component port (8 patterns, MIT licensed)

1. **Sidebar** — collapsible icon menu
2. **Topbar** — avatar dropdown, notifications
3. **StatCard** — dashboard tiles
4. **DataTable** — sortable, paginated
5. **FormField** — input/select/textarea styling
6. **Modal/Dialog** — Radix Dialog + TailAdmin styling
7. **Badge** — role/status pills
8. **Breadcrumb** — nav

Tailwind v4 `@theme` admin tokens (`global.css`):

```css
@theme {
  --color-admin-sidebar: oklch(28% 0.05 250);
  --color-admin-accent: oklch(60% 0.15 200);
  /* …kept separate from public-site theme switcher */
}
```

---

## 6. Migration: MD/YAML → Supabase

`scripts/migrate-content-to-db.mjs`:

```
1. Load env: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
2. For each collection [members, timeline, traditions, photos, quotes, dates, locations]:
   a. Read all files src/content/{collection}/*.{md,yaml}
   b. Parse frontmatter + body (gray-matter / yaml)
   c. Validate against Zod schema (existing src/content.config.ts)
   d. Map camelCase → snake_case
   e. Two-pass relations:
      - Pass 1: insert all rows without FK relations
      - Pass 2: update parent FK + insert M2M rows
   f. Backfill members.branch = 'both' (user reviews + edits)
3. Photos:
   - Detect image files in src/content/photos/*.{svg,jpg,png}
   - Upload to Supabase Storage bucket `photos` with prefix `seed/`
   - Insert rows with src = storage public URL
4. Modes: --dry-run prints diff; --apply commits
5. Idempotent: upsert by id; safe to re-run
```

Run: `pnpm migrate:dry` → review → `pnpm migrate:apply` → verify counts → log to `MIGRATION-PHASE-2.md`.

---

## 7. Public Site Rebuild Flow

```
1. Editor saves → Supabase row update
2. After-update trigger → Supabase Database Webhook (debounce 30s)
   → POST GHA workflow_dispatch
3. GHA workflow rebuild.yml:
   - actions/checkout
   - pnpm install
   - astro build (queries Supabase via SERVICE_ROLE_KEY)
   - Coolify webhook deploy
4. Astro public pages:
   - getStaticPaths() queries Supabase → prerender HTML
   - Build time ~30–60s for current dataset
```

---

## 8. Coolify Deploy Changes

**Current**: nginx multi-stage container serves `dist/` static.

**After Phase 2**: Node container serves Astro hybrid:

- `Dockerfile`: build → `node dist/server/entry.mjs` (port 3000)
- `nginx.conf`: removed (or kept only as static-asset cache layer)
- Coolify Traefik handles HTTPS termination + routing
- Env vars set in Coolify:
  - `PUBLIC_SUPABASE_URL`
  - `PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY` (build + SSR)
  - `RESEND_API_KEY` (notifications)
  - `GH_REBUILD_TOKEN` (GHA webhook auth)

---

## 9. Implementation Phases

| Phase | Scope | Effort | Depends |
|---|---|---|---|
| **P0 — Spike** | Astro hybrid + Node adapter on `phase2-spike`. Verify static + SSR coexist. | 0.5d | none |
| **P1 — Supabase** | Project, schema migrations, RLS, seed `allowed_emails`. Local connect. | 1d | Supabase account |
| **P2 — Migration script** | `migrate-content-to-db.mjs` dry-run + apply. Backup MD/YAML. Verify counts. | 1d | P1 |
| **P3 — Public DB queries** | Convert 9 public pages from `getCollection()` → Supabase. Visual regression. | 1.5d | P2 |
| **P4 — Auth + AdminLayout** | Login, Supabase Auth, callback, session middleware, AdminLayout (Sidebar + Topbar). | 1.5d | P1 |
| **P5 — Members CRUD** | List, filters, create/edit, relations, soft-delete, audit log. | 2d | P4 |
| **P6 — 6 collections** | Replicate P5 for timeline, traditions, photos (upload), quotes, dates, locations. | 3d | P5 |
| **P7 — Admin pages** | `/admin/users`, `/admin/allowed-emails`, `/admin/audit`, dashboard. | 1.5d | P5 |
| **P8 — Rebuild webhook** | Supabase webhook → GHA → Coolify rebuild. End-to-end test. | 0.5d | P3, P5 |
| **P9 — Mobile polish + i18n** | Responsive QA, VI labels, keyboard nav, toasts, loading states. | 1d | P6, P7 |
| **P10 — Soft launch** | Invite 1–2 cô chú test users. Iterate. 1-page onboarding doc. | 0.5d | P9 |

**Total**: ~14 dev-days (1 person, no buffer).

---

## 10. Decision Log (12)

| # | Decision | Alternatives | Rationale |
|---|---|---|---|
| 1 | Custom build (Path B) | Sveltia native; Sveltia + OAuth proxy | SSO + admin approval + granular permissions are required; Sveltia does not support natively |
| 2 | Supabase Postgres = source of truth | Git-as-CMS via Octokit; hybrid sync | RLS native, type-safe, no Octokit edge cases |
| 3 | Google SSO + email magic link | GitHub OAuth; password | Cô chú don't have GitHub; magic link bypasses passwords |
| 4 | Roles `admin/editor/branch_editor` | Flat editor only | User wants nhánh nội/ngoại scope |
| 5 | Email whitelist (specific) | Domain whitelist | Most cô chú on @gmail.com → domain whitelist is insecure |
| 6 | Public pages static + rebuild webhook | SSR live DB | Preserve Lighthouse ≥95; saves are infrequent |
| 7 | Supabase Storage for images | Git binary; Cloudinary | CDN built-in, free tier sufficient, no git bloat |
| 8 | Port 8 TailAdmin components (MIT) | Wholesale clone; custom from scratch | Save UI time, MIT-compatible, no template lock-in |
| 9 | Direct save | 2-step editorial flow | Trusted editors + role guardrail; no review complexity |
| 10 | Astro hybrid + Node adapter | Separate Vercel /admin app; static + serverless functions | Single repo, single deploy, single domain |
| 11 | Audit log forever | TTL retention | Data small, free tier ample |
| 12 | One-time MD/YAML → DB migration | Dual-write DB + git | Avoid sync complexity; git history preserves original content |

---

## 11. Success Criteria (Phase 2 acceptance)

- [ ] All 9 public pages still build and render via Supabase queries; Lighthouse ≥95 maintained.
- [ ] Editor (test cô chú) can: login Google → land on dashboard → edit a member → save → see change live within 2 minutes.
- [ ] Admin can: see pending signups → approve → assign role/branch → revoke if needed.
- [ ] `branch_editor` cannot save members outside their branch (RLS test).
- [ ] Audit log captures every create/update/delete with actor + diff.
- [ ] Mobile (iPhone Safari, Android Chrome) admin UX is usable: forms not cropped, buttons tappable ≥44px, no horizontal scroll.
- [ ] Image upload works end-to-end: pick → upload → URL stored → renders on public page after rebuild.
- [ ] Privacy scan (`pnpm check:privacy`) still passes — `contactPublic=false` member data not in dist/.
- [ ] Onboarding doc (1 page Vietnamese) handed to test users.

---

## 12. References

- Phase 1 source of truth: `DESIGN.md`
- Deprecated Sveltia plan: `PHASE-2-ADMIN.md`
- Migration log (created in P2): `MIGRATION-PHASE-2.md`
- TailAdmin Free (MIT): https://github.com/TailAdmin/tailadmin-free-tailwind-dashboard-template
- Supabase docs: managed Postgres + Auth + Storage + Database Webhooks
