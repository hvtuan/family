# DESIGN — Media Management v2 (WordPress-class)

> **Status**: Approved 2026-05-07. Source of truth cho phase media-v2.
> **Scope**: Thay thế hệ media hiện tại (`/admin/photos` flat list + AttachmentInput rời rạc) bằng media library hub kiểu WordPress.
> **Owner**: chú An (vận hành), Claude (build).

---

## 1. Understanding Lock

### Mục đích
Nâng quản lý ảnh từ "form đơn lẻ + URL paste" lên một **Media Library hub** với grid view, search, drag-drop, bulk ops, EXIF strip, multi-size variants, và **modal picker** tích hợp vào mọi form (member/timeline/tradition).

### Người dùng
- 5-10 cô chú không tech, dùng tiếng Việt, scale ≤2,000 ảnh lifetime
- Chú An là admin chính, cô chú khác role editor

### Constraints
- Self-host Supabase (Storage + Postgres) trên cùng VPS
- Không dùng AI service ngoài (Anthropic vision, etc.) — privacy
- Astro 6 SSR, không có job queue → resize đồng bộ tại request
- ≤25MB/ảnh upload (validate sớm)

### Non-goals
- ❌ Trash/restore 30 days (Postgres backup đủ)
- ❌ Folder tree taxonomy (tag `text[]` đủ)
- ❌ AI alt text / face recognition
- ❌ Versioning ảnh (replace = overwrite)
- ❌ EXIF browse UI (privacy: strip mặc định)
- ❌ CDN signed URLs (Storage public)

---

## 2. Assumptions (đã ghi nhận)

| # | Assumption | Trạng thái |
|---|---|---|
| A1 | Scale ≤2,000 ảnh, ≤10 user concurrent, ≤25MB/ảnh input | ✓ confirmed |
| A2 | Supabase image transforms addon CHƯA enable; resize via `sharp` ở Node | ✓ confirmed |
| A3 | Không cần versioning/restore; replace = overwrite, giữ row id | ✓ confirmed |
| A4 | Caption per-link CẦN có (`photo_members.note` + `role`) | ✓ confirmed |
| A5 | Migrate `timeline.image` + `tradition.image` sang `photo_id` FK | ✓ confirmed |
| A6 | EXIF strip mặc định ON (bỏ GPS + camera serial), giữ orientation | ✓ confirmed |
| A7 | Albums/folders không cần — `photos.tags TEXT[]` đủ | ✓ confirmed |
| A8 | UI tiếng Việt, label rõ, error thân thiện, không expose technical terms | ✓ confirmed |

---

## 3. Decision Log

| # | Quyết định | Thay thế | Lý do |
|---|---|---|---|
| 1 | **Option B — WP-style hub** | A polish, C DAM | Sweet spot effort/value (5 day effort, 95% WP parity) |
| 2 | `sharp` ở Node, không Supabase render addon | Supabase image transform | Self-host addon chưa setup, sharp đơn giản hơn, đã pinned trong `package.json` |
| 3 | 3 variants: `thumb 320w` / `medium 800w` / `original` | Single size hoặc 5 sizes | 3 = đủ mobile/grid/full; >3 phình storage |
| 4 | Strip EXIF mặc định ON | Cho user opt-out | Privacy default-on; cô chú không biết EXIF |
| 5 | Variants `webp`, original giữ format gốc | Tất cả webp / tất cả gốc | Variants webp = nhỏ (~20-30% JPG); original giữ JPG/PNG cho download |
| 6 | Storage layout `media/<id>/{original,medium,thumb}.<ext>` | Flat `<id>_thumb.webp` | Easy delete cascade; folder per photo |
| 7 | `photo_members.note` + `role` | Single shared caption | User cần ghi chú khác per-member |
| 8 | Migrate timeline/tradition.image → photo_id | Giữ 2 hệ thống | Một source of truth (precedent: embedded_photos) |
| 9 | Không trash/restore | WP 30-day trash | Quá phức tạp; backup Postgres đủ |
| 10 | Modal `<MediaPicker>` reusable | Inline AttachmentInput | UX hub-and-spoke (key WP innovation) |
| 11 | Tags `text[]`, không folders | FileBird folder tree | Tag đủ; folder gây tâm lý sắp xếp tốn thời gian |
| 12 | Bulk delete OK; bulk move/rename không | Full bulk ops | YAGNI |
| 13 | Cache-bust URL với `?v=<updated_at>` | Đổi URL khi replace | Giữ stable URL, query param force CDN flush |
| 14 | HEIC convert dùng `heic-convert` chỉ KHI user upload `image/heic` | Convert mọi ảnh | Lazy-load lib, +0KB cho đa số user |

---

## 4. Architecture

### 4.1 Schema thay đổi (`migration 0010_media_v2.sql`)

```sql
-- Per-link caption + role
alter table family.photo_members
  add column note text,
  add column role text default 'in_photo'
    check (role in ('in_photo','referenced','taken_by'));

-- Variants + metadata
alter table family.photos
  add column src_thumb text,
  add column src_medium text,
  add column width int,
  add column height int,
  add column bytes int,
  add column mime text,
  add column exif_stripped boolean default true;

-- Timeline + Tradition link to photos (kept .image text for backfill phase)
alter table family.timeline
  add column photo_id uuid references family.photos(id) on delete set null;
alter table family.traditions
  add column photo_id uuid references family.photos(id) on delete set null;

-- Multi-image timeline event (optional)
create table if not exists family.photo_timeline (
  photo_id uuid references family.photos(id) on delete cascade,
  timeline_id bigint references family.timeline(id) on delete cascade,
  sort_order int default 0,
  primary key (photo_id, timeline_id)
);

-- Photos at locations
create table if not exists family.photo_locations (
  photo_id uuid references family.photos(id) on delete cascade,
  location_id text references family.locations(id) on delete cascade,
  primary key (photo_id, location_id)
);

-- Indexes
create index if not exists idx_photos_tags on family.photos using gin (tags);
create index if not exists idx_photos_year on family.photos (year);
```

### 4.2 Storage layout

```
family-photos/
  media/<photo_id>/
    original.<ext>          # JPG/PNG/WebP/GIF/SVG, EXIF stripped
    medium.webp             # 800w, q=85
    thumb.webp              # 320w, q=80
  avatars/<member_id>.<ext> # Giữ — single size đủ
  seed/...                  # Giữ
```

`uploads/` cũ → migrate sang `media/<id>/original.<ext>` + sinh thumb/medium (idempotent script).

### 4.3 Components mới

```
src/components/admin/media/
  MediaLibrary.astro       # Grid hub /admin/media (replaces /admin/photos)
  MediaCard.astro          # 1 ô grid: thumb 320 + checkbox + hover overlay
  MediaSidebar.astro       # Detail panel phải: alt/caption/tags/linked-to/replace/delete
  MediaUploader.astro      # Drag-drop overlay full-screen + progress UI
  MediaPicker.astro        # Modal reusable: tabs [Library | Upload], onSelect callback
  MediaFilters.astro       # Search + date select + tag chips
  MediaBulkBar.astro       # Sticky bottom bar khi có selection

src/scripts/
  media-uploader.ts        # Drag-drop binding, parallel upload, progress, HEIC detect
  media-picker.ts          # Modal open/close, selection state via custom events
```

### 4.4 Backend lib

```
src/lib/media-admin.ts     # Replaces photos-admin.ts; preserves API surface used by existing pages
  - uploadPhoto(file, opts)         # sharp resize → 3 variants → insert row
  - replacePhoto(photoId, file)     # overwrite blob, regen variants, giữ row, bump updated_at
  - deletePhoto(photoId)            # cascade Storage 3 file + row + M2M
  - searchPhotos({ q, tag, year, linkedTo })
  - bulkDelete(ids[])
  - bulkTag(ids[], tags[], action: 'add'|'remove')
  - attachToMember(photoId, memberId, { note?, role? })
  - detachFromMember(photoId, memberId)

src/lib/exif.ts
  - processImage(buf, mime)         # sharp().rotate() (auto-orient) + .withMetadata({}) (strip)
  - generateVariants(buf)           # returns { original, medium, thumb, width, height }
  - convertHeicIfNeeded(file)       # lazy-load heic-convert only if mime === image/heic
```

### 4.5 Routes

```
/admin/media                  # Hub (grid + sidebar + filters)
/admin/media/[id]             # Edit modal-style fullpage
/admin/media/upload           # POST multipart endpoint
/admin/media/[id]/replace     # POST replace blob
/admin/media/bulk             # POST { action: 'delete'|'tag', ids[] }
/admin/photos                 # → 301 redirect /admin/media (backward compat)
/admin/photos/[id]            # → 301 redirect /admin/media/[id]
```

### 4.6 Modal picker UX

Trên `MemberForm`, `TimelineForm`, `TraditionForm`:

```
Ảnh đại diện:
  ┌────────────────────────────┐
  │ [Thumb 80x80] tên-file.jpg │  [Đổi]  [Xóa]
  │   Alt: "Ông Tổ năm 1950"   │
  └────────────────────────────┘
  
[+ Chọn ảnh từ thư viện]   [+ Tải ảnh mới lên]
```

- Click "Chọn từ thư viện" → modal grid search/filter, click 1 ảnh → set `photo_id` hidden field
- Click "Tải mới" → drag-drop modal, upload xong tự chọn
- Hidden field POST: `photo_id=<uuid>` thay vì `photo=<url>`
- Server resolve `photo_id` → `photos.src` để render

### 4.7 EXIF strip pipeline

```typescript
import sharp from 'sharp';

const buf = Buffer.from(await file.arrayBuffer());
const pipeline = sharp(buf).rotate(); // auto-orient via EXIF orientation tag
const meta = await pipeline.metadata();

const original = await pipeline.clone()
  .withMetadata({})  // strip ALL EXIF
  .toBuffer();

const medium = await pipeline.clone()
  .resize({ width: 800, withoutEnlargement: true })
  .webp({ quality: 85 })
  .withMetadata({})
  .toBuffer();

const thumb = await pipeline.clone()
  .resize({ width: 320, withoutEnlargement: true })
  .webp({ quality: 80 })
  .withMetadata({})
  .toBuffer();

return { original, medium, thumb, width: meta.width, height: meta.height, mime: file.type };
```

Verify GPS gone: `exiftool` trên file uploaded → no `GPS*` tags.

### 4.8 Cache-bust strategy

- Public URL không đổi: `https://supabase.huynhvantuan.net/storage/v1/object/public/family-photos/media/<id>/medium.webp`
- Khi replace: `photos.updated_at` bump → render với `?v=<timestamp>` query param
- Cloudflare cache key includes query string → flush ngay

### 4.9 HEIC support

```typescript
// Lazy-load heic-convert ONLY when needed
async function convertHeicIfNeeded(file: File): Promise<File> {
  if (file.type !== 'image/heic' && !file.name.toLowerCase().endsWith('.heic')) {
    return file;
  }
  const heicConvert = (await import('heic-convert')).default;
  const buf = Buffer.from(await file.arrayBuffer());
  const jpgBuf = await heicConvert({ buffer: buf, format: 'JPEG', quality: 0.9 });
  return new File([jpgBuf], file.name.replace(/\.heic$/i, '.jpg'), { type: 'image/jpeg' });
}
```

`heic-convert`: ~150KB, MIT, no native deps.

---

## 5. Implementation phases

| Phase | Scope | Deliverables | Effort |
|---|---|---|---|
| **M1** | Schema + sharp pipeline | `0010_media_v2.sql` migration; `src/lib/exif.ts`; `src/lib/media-admin.ts` (uploadPhoto/replacePhoto/deletePhoto with variants); unit smoke test resize+EXIF strip | 1d |
| **M2** | `/admin/media` hub UI | MediaLibrary grid; MediaCard thumb+select; MediaSidebar detail; MediaFilters search/date/tag; existing `/admin/photos` 301 | 1.5d |
| **M3** | Drag-drop + upload + replace | MediaUploader full-screen overlay; parallel upload progress; replace-in-place button on detail; HEIC detect | 0.5d |
| **M4** | MediaPicker + integrate forms | MediaPicker modal; integrate vào MemberForm (avatar), TimelineForm (image), TraditionForm (image); MemberPhotos refactor | 1d |
| **M5** | Migrate timeline/tradition.image → photo_id | Idempotent script `migrate-image-to-photo.mjs`; backfill production; verify no orphans | 0.5d |
| **M6** | Polish + UAT | Alt-required warning; copy-URL; clipboard paste; bulk select; smoke + privacy + browser test | 0.5d |
| **Total** | | | **5d** |

---

## 6. Risks & Mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| `sharp` thêm 6MB Docker image | Low | Đã có sẵn trong package.json; one-time cost |
| Migration timeline/tradition image fail giữa chừng | Med | Idempotent script + dry-run + transaction per record |
| Sharp upload time-out với ảnh 50MB | Med | Validate `file.size ≤ 25MB` reject sớm |
| Replace-in-place khiến URL cache cũ | Low | `?v=<updated_at>` cache-bust |
| Drag-drop fail Safari iOS | Med | Test ngày đầu; fallback button click multi-select |
| User accidental bulk delete | High | Confirm dialog đếm số ảnh + Hủy default focus |
| Schema rollback khó | Low | Cột nullable + default; rollback = drop column |
| HEIC convert slow trên ảnh lớn | Med | Show "Đang chuyển HEIC..." status; cap size 25MB pre-convert |

---

## 7. Acceptance Criteria

- [ ] `/admin/media` grid load 200 ảnh < 2s (thumb 320w lazy-load)
- [ ] Drag-drop 10 ảnh đồng thời → 10 success hoặc lỗi rõ per-ảnh
- [ ] EXIF GPS strip verified bằng `exiftool` trên file uploaded
- [ ] Replace ảnh → URL public render content mới sau bump `?v=`
- [ ] Modal picker từ MemberForm chọn ảnh có sẵn → save → public render đúng `photo_id` resolve
- [ ] Migrate `timeline.image` + `tradition.image` → `photo_id` 100%, no orphans
- [ ] `pnpm db:smoke` pass; privacy scan pass; `astro check` zero errors
- [ ] Bulk delete 5 ảnh → confirm → 3 variants xóa khỏi Storage + row + M2M
- [ ] Alt text required warning visible nếu thiếu khi save
- [ ] HEIC upload từ iPhone Safari → tự convert JPG, render đúng

---

## 8. Future / Deferred (KHÔNG trong v2)

- Trash/restore 30 days
- Folder taxonomy
- AI alt text / face suggest
- Versioning với restore
- Public album share link với passcode
- Geocode EXIF GPS → suggested location
- EXIF metadata browse UI

---

## 9. References

- `DESIGN.md` — phase 1 base
- `DESIGN-PHASE-2-ADMIN.md` — phase 2 admin
- WordPress Media Library docs (feature parity matrix in §2 of brainstorm)
- `cropperjs@^1.6` — image editor (giữ nguyên)
- `sharp@^0.34` — server-side resize/EXIF
- `heic-convert` (lazy) — iPhone HEIC support
