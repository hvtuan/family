-- 0011_media_video.sql
--
-- Media v2 + video. The "photos" table now holds mixed media:
-- still images (kind='image', default — preserves existing rows) and
-- videos (kind='video') uploaded from phones.
--
-- Storage layout for video rows:
--   media/<id>/original.<ext>    (mp4 / webm / mov)
--   media/<id>/poster.webp       (frame extracted client-side)
--
-- For video rows the existing src_thumb + src_medium columns reuse the
-- poster URL — no separate medium variant is generated. duration_seconds
-- is captured at upload time so the picker can show "0:32" badges.

alter table family.photos
  add column if not exists kind text not null default 'image'
    check (kind in ('image','video')),
  add column if not exists duration_seconds int;

create index if not exists photos_kind_idx on family.photos(kind);
