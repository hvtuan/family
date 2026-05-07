# Gia phả họ Nguyễn — Tịnh Khê

Trang gia phả nhiều thế hệ, song ngữ Việt–Anh. Astro 6 SSR + Tailwind v4 + React 19 islands, lưu trữ trên Supabase self-host, deploy qua Coolify + Cloudflare Tunnel.

Live: <https://family.huynhvantuan.net>

## Tính năng

**Public site** — 9 trang công khai
- Trang chủ với slideshow hero (ảnh + video, có Ken Burns + cross-fade), thống kê dòng họ, câu trích dẫn nổi bật.
- Cây gia phả tương tác (pan/zoom SVG, lọc theo nhánh nội/ngoại, click mở modal thành viên).
- Thành viên — danh sách + tìm kiếm, modal chi tiết với photo carousel, mốc thời gian cá nhân, bản đồ gắn nơi gắn bó.
- Mốc thời gian cộng đồng — sự kiện chung của dòng họ.
- Album ảnh — masonry layout + lightbox.
- Truyền thống — chuyện kể, nghi lễ.
- Câu nói — quote ông bà, có author ref.
- Lịch ngày kỷ niệm — sinh nhật + giỗ, kèm âm lịch.
- Bản đồ quê hương — Google Maps marker, chỉ vẽ những địa điểm gắn với gia đình.

**Admin panel** (`/admin`) — quản lý nội dung không cần redeploy
- Quản lý thành viên, mốc thời gian, truyền thống, câu nói, ngày lễ, địa điểm.
- Thư viện media v2: upload ảnh/video qua Uppy (Dashboard + ImageEditor + XHRUpload + Webcam), Cropper.js, sharp xử lý server, EXIF strip, HEIC convert, sinh thumb/medium/full.
- Hero slideshow: drag-drop reorder (dnd-kit), bulk toggle, schedule (active_from/to), mobile variant ảnh khác desktop, live preview, default duration cấu hình được.
- Cài đặt website (44 key × 11 category): brand, social, SEO/OG image, analytics, SMTP, maps default, hero default, privacy toggles — sửa qua UI typed widgets (boolean switch / select / number / url preview / password mask).
- Audit log mọi thao tác.
- Phân quyền admin / member / pending qua `app_users` + magic-link / username-password login.

## Stack

- [Astro 6](https://astro.build) — SSR mode (`@astrojs/node`)
- TypeScript strict
- [Tailwind CSS v4](https://tailwindcss.com) — CSS-first `@theme`, hai bộ token: `global.css` (public, paper / vermilion / jade / gold) và `admin.css` (shadcn-style brand / gray / success / error)
- [React 19](https://react.dev) — islands only
- [Supabase](https://supabase.com) self-host — Postgres + Storage + Auth (schema `family`)
- [Radix UI](https://www.radix-ui.com) Dialog · Tabs · Tooltip
- [Embla Carousel](https://www.embla-carousel.com) + `embla-carousel-fade` + `embla-carousel-autoplay`
- [@dnd-kit](https://dndkit.com) — drag-drop reorder
- [@vis.gl/react-google-maps](https://visgl.github.io/react-google-maps/) — public map + admin location picker
- [react-photo-album](https://react-photo-album.com) + [yet-another-react-lightbox](https://yet-another-react-lightbox.com) — album
- [Uppy](https://uppy.io) v5 + [Cropper.js](https://github.com/fengyuanchen/cropperjs) — upload + crop
- [sharp](https://sharp.pixelplumbing.com) + [heic-convert](https://github.com/catdad-experiments/heic-convert) — server-side image pipeline
- [cmdk](https://cmdk.paco.me) — admin command palette
- [Sonner](https://sonner.emilkowal.ski) toast
- [Nanostores](https://github.com/nanostores/nanostores) — cross-island state

## Cấu trúc

```
src/
├── content.config.ts            # Zod schemas cho content collections
├── content/                     # File-based collections (markdown)
├── components/
│   ├── astro/                   # SSR-only UI (HeroSlideshow, MemberCard, …)
│   ├── react/                   # Hydrated islands (FamilyTree, MemberModal, …)
│   ├── admin/                   # Admin React + Astro components
│   └── ui/                      # shadcn primitives
├── layouts/
│   ├── Base.astro               # public shell — header, footer, theme, OG
│   └── AdminLayout.astro        # admin shell — sidebar, topbar, command palette
├── lib/
│   ├── settings.ts              # key-value store reader/writer + cached helpers
│   ├── hero-admin.ts            # hero_slides CRUD + schedule filtering
│   ├── locations-admin.ts
│   ├── members-client.ts        # sensitive-field strip
│   ├── supabase/
│   │   ├── server.ts            # SSR client w/ cookies
│   │   └── admin.ts             # service-role client (server-only)
│   └── content.ts               # collection readers
├── pages/
│   ├── index.astro              # /, family-tree, members, album, …
│   └── admin/                   # /admin/*
├── stores/ui.ts                 # nanostores
└── styles/
    ├── global.css               # public @theme tokens
    └── admin.css                # shadcn @theme tokens

supabase/migrations/             # 0000…0015 incremental SQL migrations
scripts/
├── seed-demo-data.mjs           # populate demo members/locations/timeline/quotes
└── check-bundle-privacy.mjs     # post-build scan for leaked contact fields

Dockerfile, nginx.conf           # multi-stage container for Coolify
.github/workflows/ci.yml         # build + privacy scan + Coolify webhook
```

## Commands

```bash
pnpm install            # install deps
pnpm dev                # dev server tại http://localhost:4321
pnpm build              # type-check + SSR build → dist/
pnpm preview            # preview built site
pnpm check              # astro check only
pnpm check:privacy      # quét dist/ tìm field contact bị rò rỉ
pnpm db:migrate         # apply tất cả migration trong supabase/migrations/
pnpm seed:demo          # populate demo data (chỉ dùng môi trường test)
```

## Settings system (admin-editable)

Hệ thống `family.settings` cho phép admin sửa các giá trị runtime mà KHÔNG cần rebuild code. 44 key × 11 category, mỗi key có `field_type` để admin form render đúng widget (text / password / textarea / number / boolean / url / color / select). Cache 30s in-memory, invalidate khi save.

Categories:
- `site` — brand vi/en, hometown, motto, monogram, established year, tagline, favicon
- `contact` — admin email/phone, public URL, notify emails
- `social` — Facebook, YouTube, Instagram, Zalo OA links
- `seo` — indexing toggle, default description, OG image URL, Twitter handle
- `integrations` — Google Maps API key
- `analytics` — Umami (URL + site ID), Plausible domain, Google Analytics ID
- `smtp` — host, port, user, password, from email (cho future notify-on-X)
- `maps` — default lat/lng/zoom cho map mới khi tạo location
- `hero` — default slide duration, height, "show lotus when slideshow active"
- `appearance` — default theme (classic / scroll / modern)
- `privacy` — show admin link in footer, show theme switcher, lunar-first

Vào `/admin/settings` để chỉnh. Server-only secrets (`SUPABASE_SERVICE_ROLE_KEY`, …) vẫn ở env, không expose qua surface này.

## Editing content

- **Static collections** (truyền thống, câu nói, mốc thời gian, ngày lễ, địa điểm cũ): file markdown trong `src/content/{collection}/`, edit trực tiếp.
- **Database content** (members, photos, hero_slides, locations mới, app_users, audit_log, settings): qua admin panel hoặc trực tiếp trên Supabase.

Migration mới? Thêm file `supabase/migrations/NNNN_xxx.sql` rồi chạy `pnpm db:migrate`.

## Privacy

Members có `contactPublic: false` (default) sẽ bị strip `phone`, `email`, `address`, `social.*` trước khi serialize vào client bundle. `pnpm check:privacy` chạy sau mọi build (kể cả CI) và fail nếu rò rỉ. Members có `contactPublic: true` opt-in hiển thị contact ở modal tab "Liên lạc".

`<meta name="robots">` đọc `seo.indexing_enabled` setting — mặc định `noindex, nofollow`. Bật khi muốn public.

## Themes

Ba theme (Classic / Scroll / Modern Heritage). Toggle ở header public site, lưu vào `localStorage.theme`. Inline script trong `<head>` set `<html data-theme>` trước khi React hydrate để tránh flash.

Admin có thể tắt theme switcher qua `privacy.show_theme_switcher`.

## Environment

Tạo `.env.local`:
```
PUBLIC_SUPABASE_URL=https://supabase.example.com
PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...      # server-only
PUBLIC_GOOGLE_MAPS_API_KEY=...     # fallback nếu chưa nhập vào /admin/settings
```

## Deploy

Xem [`DEPLOY.md`](./DEPLOY.md) cho Coolify + Cloudflare Tunnel.

Quy trình:
1. Push lên `main` → GitHub Actions build + privacy check
2. CI hit Coolify webhook → Coolify pull container build mới
3. Cloudflare Tunnel route `family.huynhvantuan.net` → Coolify container :4321

Settings thay đổi qua `/admin/settings` áp dụng trong 30s (cache TTL) — không cần redeploy. Code thay đổi (component, schema, migration mới) cần push + rebuild.

## Phase status

- ✅ **Phase 1** — Public site (9 trang, content collections, theme, privacy strip)
- ✅ **Phase 2** — Admin panel (members/timeline/traditions/photos/quotes/dates/locations CRUD, media v2, hero slideshow manager, audit log, app_users, settings system)
- 🔜 **Phase 3** (chưa lên kế hoạch) — public-facing search, multi-language full content, mobile app?

## License

Private family project.
