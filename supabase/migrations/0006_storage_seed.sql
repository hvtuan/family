-- 0006_storage_seed.sql
-- Storage bucket scoped to family project.
-- Bucket name uses `family-photos` prefix to avoid collision with other
-- projects on the same self-hosted Supabase instance.
--
-- Admin email seed is handled by scripts/db-migrate.mjs after applying SQL
-- (uses ADMIN_EMAIL from .env.local).

-- ─── family-photos bucket (public-read, authenticated-write) ─────────────────
insert into storage.buckets (id, name, public)
values ('family-photos', 'family-photos', true)
on conflict (id) do nothing;

-- Storage policies: anyone reads, only approved family editors write/delete.
drop policy if exists "family_photos_public_read" on storage.objects;
drop policy if exists "family_photos_approved_write" on storage.objects;
drop policy if exists "family_photos_approved_update" on storage.objects;
drop policy if exists "family_photos_approved_delete" on storage.objects;

create policy "family_photos_public_read"
  on storage.objects for select
  using (bucket_id = 'family-photos');

create policy "family_photos_approved_write"
  on storage.objects for insert
  with check (
    bucket_id = 'family-photos'
    and family.current_role() in ('admin','editor','branch_editor')
  );

create policy "family_photos_approved_update"
  on storage.objects for update
  using (
    bucket_id = 'family-photos'
    and family.current_role() in ('admin','editor','branch_editor')
  );

create policy "family_photos_approved_delete"
  on storage.objects for delete
  using (
    bucket_id = 'family-photos'
    and family.current_role() in ('admin','editor','branch_editor')
  );
