# Phase 2 — Content Migration Log (P2)

> Migration: file-based content (`src/content/**`) → `family.*` tables on self-hosted Supabase.
> Status: complete. Date: 2026-05-05.
> Repo branch: `phase2-spike`.

## Tooling

- Driver: `scripts/migrate-content-to-db.mjs` (Node 22, postgres npm pkg, gray-matter, js-yaml, mime-types, @supabase/supabase-js)
- Modes: `pnpm db:seed:dry` (`--dry-run`) and `pnpm db:seed` (`--apply`)
- DB connection: direct via `SUPABASE_DB_URL` (Postgres in supabase-db container)
- Storage: Supabase Storage bucket `family-photos`, prefix `seed/`

## Schema additions

`supabase/migrations/0008_source_file.sql` adds `source_file text` column +
unique partial index on `family.timeline`, `family.quotes`, `family.dates` so
the migrator can upsert files keyed by filename even though those tables use
`bigserial` primary keys.

Tables already keyed by text (`members`, `traditions`, `photos`, `locations`)
upsert by their natural `id` field.

## Field mapping

camelCase YAML/MD → snake_case DB columns. Collision renames:
- `text` → `text_vi` (reserved-ish) on `family.quotes`
- `desc` → `desc_text` on `family.timeline`, `family.traditions`

Embedded objects (Zod arrays / nested objects in source YAML) preserved as
`jsonb`:
- `members.hobbies`, `members.tags`
- `members.achievements`, `members.anecdotes`
- `members.embedded_photos` (the inline `photos: [...]` array — the
  standalone `photos` collection lives in its own table)
- `members.social` (`{facebook, instagram, zalo}`)

## Photo upload flow

For every `src` referenced by `members.photo`, `members.photos[].src`, or
`photos.src`:

1. Resolve the relative path against the source YAML/MD's directory.
2. Read bytes from disk (`src/assets/photos/*.svg|jpg|png`).
3. Upload to `family-photos/seed/<basename>` with detected `Content-Type`.
4. Cache the upload by absolute fs path to avoid re-uploading the same image.
5. Replace `src` in the row with the public URL
   `https://supabase.huynhvantuan.net/storage/v1/object/public/family-photos/seed/<basename>`.

On re-run, `storage.list()` checks if the object already exists and skips
the upload (idempotent). Counted in stats as `skipped_uploads`.

## Two-pass for members

Members reference each other via `father`/`mother`/`spouse` (single FKs) and
`children` (list). To avoid forward-reference errors:

1. **Pass 1**: insert/upsert every member row with `father_id = mother_id =
   spouse_id = NULL`.
2. **Pass 2**: `UPDATE` each member to set the three FKs from the source
   `father`/`mother`/`spouse` fields. Then materialise `children: [...]` into
   `family.member_children` (M2M), `delete + insert` to keep it in sync with
   the source.

The deferrable FK constraints on `members.father_id` etc. let the upserts
land in any order without violating constraints.

## Run summary (2026-05-05)

```
mode: APPLY

  members:    { read: 4, upsert: 4, fk_update: 4, m2m: 3 }
  timeline:   { read: 1, upsert: 1, m2m: 2 }
  traditions: { read: 1, upsert: 1 }
  photos:     { read: 1, upsert: 1, m2m: 3, uploaded: 3, skipped_uploads: 0 }
  quotes:     { read: 1, upsert: 1 }
  dates:      { read: 1, upsert: 1 }
  locations:  { read: 1, upsert: 1, m2m: 3 }
```

Verified post-apply via direct DB query:
- Row counts match dry-run plan exactly.
- FK lineage walks correctly: `g3-1 (gen 3) → father g2-1 → father g1-1 (Cụ Tổ) ↔ spouse g1-2 (Cụ Bà)`.
- `member_children` M2M has 3 rows mirroring the YAML `children:` lists.
- All 3 photo URLs return `200` with `image/svg+xml`.
- Audit-log trigger captured every `insert` + the pass-2 `update`.
- 2nd apply pass produced identical row counts; photos all skipped (3/3).

## Idempotency invariants

- Re-running `pnpm db:seed` with no source changes ⇒ row counts unchanged.
- Editing a YAML/MD file then re-applying ⇒ that one row is updated;
  counts unchanged unless a relation list (children, related, members)
  changed (the wipe-and-reinsert M2M pattern shows up as 1 delete + N
  inserts in `audit_log`).
- Re-running with new files ⇒ rows added.
- Files removed ⇒ rows are NOT deleted automatically (script is import-
  only, never destructive). Drop rows manually via Studio if a file is
  removed and you want the DB to follow.

## What this does not do

- No `created_by` / `updated_by` populated — both are NULL because the
  service-role connection has no `auth.uid()`. Real edits via /admin in P5+
  will populate these.
- Public site (Astro pages) still queries `getCollection()` from
  `src/content/**`. Switching to Supabase queries lands in P3.
- `members.embedded_photos` is preserved as JSONB on the row, mirroring the
  Zod model. If we want each inline photo as a `family.photos` row + M2M
  link, that's a separate migration (P6 admin UX may decide one or the
  other).
