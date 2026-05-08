# DESIGN — Memorial Layer (Tưởng niệm)

**Status:** brainstorm complete (2026-05-08), implementation pending
**Predecessors:** `DESIGN.md` (Phase 1), `DESIGN-PHASE-2-ADMIN.md` (Phase 2 admin), `DESIGN-MEDIA-V2.md` (media v2)
**Approach:** Lean greenfield (Approach 1 of 3 evaluated)
**Effort estimate:** ~7 dev-days, 5 phases (M1-M5)

---

## 1. Understanding Lock

### What
1. **`/memorial/[id]`** — page tưởng niệm per-deceased member
2. **`/altar`** — Bàn thờ tổ tiên tổng hợp toàn bộ tổ tiên đã khuất
3. **Homepage banner** — hiện khi có giỗ ≤7 ngày tới
4. **"Thắp một nén tâm hương" interaction** — counter + signed guest log per anniversary year
5. **Anniversary engine** — auto-detect ngày giỗ (lunar + solar) qua `lunar-typescript`
6. **Lời tưởng nhớ (condolences)** — comments với admin moderation queue
7. **Cron alert** — email admin + branch_editor T-7, T-1, today trước mỗi giỗ
8. **Admin layer đầy đủ** — 5 page + sidebar group + settings UI + MemberForm fieldset

### Why
- Site đã content-complete + admin-complete + design-complete (Phase 1+2+3 done)
- Thiếu chiều sâu cảm xúc — đây là moat văn hóa Việt không site Tây nào (Geni/FamilySearch/MyHeritage) làm tử tế
- Leverage 100% data sẵn có (members + dates + quotes + traditions + photos), không thêm content burden

### Who
- **Primary**: cô chú lớn tuổi mở vào dịp giỗ để tưởng nhớ
- **Secondary**: con cháu xa quê thắp hương ảo
- **Admin**: tộc trưởng moderation comments + bật/tắt memorial per-member

### Key constraints
- Astro 6 SSR + React islands + shadcn + Supabase (đã có infrastructure)
- Chỉ members `death_date IS NOT NULL` mới có memorial
- Public visitor có thể thắp hương + để lời tưởng nhớ (anonymous + name field), KHÔNG cần đăng ký
- Lời tưởng nhớ cần admin approve trước khi public
- **i18n-ready từ đầu**: content fields JSONB `{vi, en}`, UI strings qua message catalog
- **Tech naming EN, content VN** (per project convention)
- **Tuyệt đối không chữ Hán/Hán-Nôm** trong UI/asset/OG
- **Tone modern × tradition**, KHÔNG gothic/horror

### Explicit non-goals
- ❌ Lễ Vu Lan / Thanh Minh / Tết mass-rite features (defer)
- ❌ Voice/audio archives của ancestors (defer)
- ❌ Văn khấn (ritual liturgy) library (có thể addon sau)
- ❌ Public user registration cho khách thắp hương
- ❌ Realtime WebSocket cho counter (poll-on-action đủ)
- ❌ 3D altar / WebGL particle khói nặng
- ❌ Multi-language EN translation đầy đủ ngay (UI render VN, EN catalog placeholder)

### Non-functional requirements
| Aspect | Target |
|---|---|
| TTFB memorial page | <500ms cho member có 50 condolences |
| OG image cold render | <800ms; cached 24h CDN |
| Scale | ≤100 deceased members, ~1k incense/giỗ peak, <50 condolences/giỗ |
| Privacy | Comments pending mặc định; rate-limit IP-hash; CAPTCHA fallback nếu spam tăng |
| Reliability | Cron idempotent; manual trigger fallback nếu cron miss |
| A11y | WCAG AA, keyboard nav, prefers-reduced-motion respect |
| Maintenance | All code EN; admin có thể disable toàn module qua `memorial.enable=false` |

---

## 2. Decision Log

| # | Decision | Alternatives considered | Why chosen |
|---|---|---|---|
| D1 | DB content fields: JSONB `{vi, en}` cho memorial-specific tables | Separate `_vi/_en` columns | Locale-extensible; scale memorial nhỏ → JSONB GIN đủ |
| D2 | Existing tables KHÔNG migrate sang i18n shape ngay | Bulk migrate now | Risk cao, low value lúc này; memorial là greenfield đi đúng từ đầu |
| D3 | UI strings: catalog `src/i18n/{vi,en}.ts` + `t()` helper | astro-i18next, nanostores/i18n | Lightweight (~50-100 keys), không thêm runtime lib |
| D4 | Routing tạm thời `/memorial/[id]`, không prefix `/vi/` | `/{lang}/memorial/[id]` ngay | Astro i18n bật sau qua config được — không phá URL hiện tại |
| D5 | OG image render theo `?lang=` query, default vi | Pre-render lúc cron | Lazy = simpler; CDN cache đủ |
| D6 | Approach 1 — lean greenfield | A2 materialized table; A3 realtime presence | Match scale (≤100 deceased), match maintenance budget (1 dev), zero new infra |
| D7 | `lunar-typescript` lib cho lunar conversion | Custom epoch table; gov API | Proven VN ecosystem, pure JS, MIT, no network dependency |
| D8 | Cron qua Coolify scheduled task | GitHub Actions cron; Supabase pg_cron | Coolify đã quản lý app, secret share dễ, no extra account |
| D9 | i18n custom lightweight | astro-i18next | Catalog vài chục keys không cần lib lớn; nanostores đã dùng |
| D10 | OG image SSR + CDN cache 24h | Pre-render lúc cron | Lazy đơn giản hơn, không premature optimization |
| D11 | Photo treatment: sepia warm filter, không hard B&W | Pure B&W, no filter | Tránh horror tone, giữ humanity |
| D12 | Vermilion reserved 1-2 chỗ duy nhất | Vermilion accent everywhere | Heritage color discipline đã chốt P1 |
| D13 | KHÔNG khói/nến animation lifecycle dài | Cinematic 8s smoke particles | "Đừng làm quá thành game kinh dị" — user explicit |
| D14 | Thêm "Kỷ niệm vui" section celebration of life | Chỉ tang lễ vibe | Tradition × modern, balance grief với joy |
| D15 | "Sổ tang" → "Lời tưởng nhớ" copy | Funereal "Sổ tang" | Phrasing ấm hơn, bớt grief-heavy |
| D16 | OG image: `@vercel/og` (Satori) JSX→PNG | Sharp + SVG manual ghép | Proven Vercel infra, JSX-to-image, font support |
| D17 | Animation: `motion` (framer-motion v11) | CSS keyframes manual | prefers-reduced-motion built-in, spring curves |
| D18 | Email: `react-email` + `nodemailer` | Plain HTML string | Component-based, render đẹp, SMTP setting có sẵn |
| D19 | Optional chime: `use-sound` (Howler.js) | Custom audio element | Lazy-load mp3, proven |
| D20 | OG image route SSR + CDN 24h | Pre-render | Data-driven, simpler |
| D21 | Moderation Sheet (shadcn) thay full page | Full page editor | Inline review tốc độ cao, admin không lose context |
| D22 | Audit log mọi moderation action | No log | Compliance + traceability — `src/lib/audit.ts` đã có |
| D23 | Reject email tới visitor default OFF | Always send | Privacy first; admin opt-in qua setting |
| D24 | Zero Hán/Hán-Nôm — strict rule | Allow 族 monogram | User explicit; project identity Việt Nam |
| D25 | Seal canonical = Lotus + tên dòng họ Quốc ngữ Dancing Script | 族 character; chữ Hán | Đã có Lotus component + font, no new dep |
| D26 | Pre-commit grep `[一-鿿]` để fail nếu lỡ insert Hán | Manual review | Defensive guardrail |
| D27 | Memorial admin tách thành nhóm sidebar riêng | Lồng vào group existing | Module có 5 page, đáng có scope riêng |
| D28 | `anniversary_calendar` enum (lunar/solar/both) per member | Always lunar | Một số gia đình ngoài VN dùng dương; flexibility |
| D29 | `death_date_lunar` JSONB editable bởi admin | Auto-only | Auto-convert có thể sai năm nhuận → admin override |
| D30 | Anonymize action thay full delete cho privacy request | Delete permanent | Giữ count thống kê |
| D31 | Pending condolence badge sidebar (cache 30s) | No badge / realtime | Admin biết có việc chưa làm, no realtime overhead |

---

## 3. Architecture overview

```
┌────────────────────────────────────────────────────────────────────────┐
│                          PUBLIC SURFACE                                 │
│                                                                         │
│  /memorial/[id]   /altar   homepage <MemorialBanner>   /og/memorial/x.png │
│        │             │              │                       │           │
│        └─────────────┴──────────────┴───────────────────────┘           │
│                              │                                           │
│                              ▼                                           │
│                    ┌──────────────────┐                                  │
│                    │  React islands   │                                  │
│                    │ IncenseButton    │ → POST /api/incense              │
│                    │ CondolenceForm   │ → POST /api/condolence           │
│                    │ CondolenceBook   │ ← GET   /api/condolence (paged)  │
│                    └──────────────────┘                                  │
└────────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌────────────────────────────────────────────────────────────────────────┐
│                            LIB LAYER                                    │
│  lunar.ts    anniversary.ts   memorial.ts   incense.ts   condolences.ts │
│  i18n.ts     og-memorial.ts   cron-auth.ts                              │
└────────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌────────────────────────────────────────────────────────────────────────┐
│                     SUPABASE (family schema)                            │
│  members (+memorial_enabled, +anniversary_calendar, +death_date_lunar)  │
│  incense_events    condolences    anniversary_alerts                    │
│  settings (memorial.* keys)                                             │
└────────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      ADMIN SURFACE                                      │
│  /admin/memorial            (dashboard hub)                             │
│  /admin/memorial/anniversaries (lịch giỗ 12 tháng)                      │
│  /admin/memorial/alerts-log (cron audit trail)                          │
│  /admin/condolences         (moderation queue)                          │
│  /admin/incense/[id]        (per-member incense log)                    │
│  /admin/members/[id]        (+ fieldset 8 "Tưởng niệm")                 │
│  /admin/settings            (+ category "Tưởng niệm")                   │
│  /admin/cron/anniversary-alerts (POST, bearer-guarded)                  │
└────────────────────────────────────────────────────────────────────────┘
                               │
                               ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        EXTERNAL                                         │
│   Coolify scheduled task → cron endpoint                                │
│   SMTP (settings) → react-email render → admin/branch_editor inboxes    │
│   Cloudflare CDN → OG image cache 24h                                   │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Database schema

Migration `supabase/migrations/0017_memorial.sql`:

```sql
-- ============================================================
-- 0017_memorial.sql — Memorial layer
-- ============================================================

-- 4.1 Append-only log: thắp hương per anniversary year
create table family.incense_events (
  id              bigserial primary key,
  member_id       text not null references family.members(id) on delete cascade,
  anniversary_year integer not null,
  visitor_name    text not null check (length(visitor_name) between 1 and 80),
  message         jsonb,
  ip_hash         text not null,
  created_at      timestamptz not null default now()
);
create index incense_member_year_idx on family.incense_events (member_id, anniversary_year);
create index incense_member_recent_idx on family.incense_events (member_id, created_at desc);

-- 4.2 Condolences (lời tưởng nhớ) với moderation
create table family.condolences (
  id              bigserial primary key,
  member_id       text not null references family.members(id) on delete cascade,
  visitor_name    text not null check (length(visitor_name) between 1 and 80),
  visitor_relation text,
  body            jsonb not null,
  status          text not null default 'pending' check (status in ('pending','approved','rejected')),
  ip_hash         text not null,
  reviewed_by     uuid references auth.users(id),
  reviewed_at     timestamptz,
  created_at      timestamptz not null default now()
);
create index condolence_member_pub_idx on family.condolences (member_id, status, created_at desc);
create index condolence_pending_idx on family.condolences (status) where status = 'pending';

-- 4.3 Audit/idempotency log cho cron giỗ alert
create table family.anniversary_alerts (
  id                 bigserial primary key,
  member_id          text not null references family.members(id) on delete cascade,
  alert_type         text not null check (alert_type in ('t-7','t-1','today')),
  anniversary_year   integer not null,
  anniversary_solar  date not null,
  sent_at            timestamptz not null default now(),
  recipients         jsonb not null,
  unique (member_id, alert_type, anniversary_year)
);

-- 4.4 Members extensions
alter table family.members
  add column if not exists memorial_enabled boolean default true,
  add column if not exists anniversary_calendar text default 'lunar'
    check (anniversary_calendar in ('lunar','solar','both')),
  add column if not exists death_date_lunar jsonb;

-- 4.5 App user preferred lang (cho email locale)
alter table family.app_users
  add column if not exists preferred_lang text default 'vi'
    check (preferred_lang in ('vi','en'));
```

**Settings keys** (seeded vào `family.settings`, không migration mới — admin seed):

| Key | Type | Default | Purpose |
|---|---|---|---|
| `memorial.enable` | boolean | `true` | Master switch toàn module |
| `memorial.banner_days_before` | number | `7` | Banner homepage hiện ≤N ngày trước giỗ |
| `memorial.alert_days_before` | text (csv) | `"7,1,0"` | Cron gửi email các mốc nào |
| `memorial.condolences_require_approval` | boolean | `true` | Mặc định pending; tắt = auto-approve |
| `memorial.incense_rate_limit_per_hour` | number | `5` | Per IP-hash |
| `memorial.chime_default_on` | boolean | `false` | Audio chime khi thắp hương — mặc định OFF |

---

## 5. Lib layer

### 5.1 File structure

```
src/lib/
├── lunar.ts            wrap lunar-typescript
├── anniversary.ts      compute upcoming giỗ per member/group
├── memorial.ts         query layer + member memorial state
├── incense.ts          record/list + rate-limit
├── condolences.ts      submit/list/moderate
├── i18n.ts             Locale, pickLocale(), t(), getLocale()
├── og-memorial.ts      generate OG image qua @vercel/og
└── cron-auth.ts        bearer secret guard
```

### 5.2 Public API surface

```ts
// lunar.ts
export type LunarDate = { year: number; month: number; day: number; isLeap: boolean };
export function solarToLunar(date: Date): LunarDate;
export function lunarToSolar(l: LunarDate): Date;
export function nextSolarOfLunar(month: number, day: number, fromDate?: Date): Date;
export function formatLunarVi(l: LunarDate): string;  // "Rằm tháng 2 năm Mậu Thìn"

// anniversary.ts
export type Anniversary = {
  member: MemorialMember;
  type: 'lunar' | 'solar';
  year: number;
  date: Date;
  daysUntil: number;
};
export async function getUpcomingAnniversaries(opts?: { withinDays?: number }): Promise<Anniversary[]>;
export async function getAnniversariesForMember(memberId: string, lookAheadYears?: number): Promise<Anniversary[]>;

// memorial.ts
export type MemorialMember = ClientMember & {
  deathDate: Date;
  deathDateLunar: LunarDate;
  memorialEnabled: boolean;
  anniversaryCalendar: 'lunar' | 'solar' | 'both';
  incenseCountThisYear: number;
};
export async function getMemorialMember(id: string): Promise<MemorialMember | null>;
export async function getDeceasedMembers(): Promise<MemorialMember[]>;
export async function getActiveBanner(): Promise<Anniversary | null>;

// incense.ts
export type IncenseEntry = { id: number; visitorName: string; message: Localized<string> | null; createdAt: Date };
export async function recordIncense(input: {
  memberId: string;
  visitorName: string;
  message?: Localized<string>;
  ipHash: string;
}): Promise<{ ok: boolean; reason?: 'rate_limit' | 'memorial_disabled' }>;
export async function listIncenseForMember(memberId: string, year: number): Promise<IncenseEntry[]>;
export async function checkRateLimit(ipHash: string): Promise<boolean>;

// condolences.ts
export type Condolence = {
  id: number;
  visitorName: string;
  visitorRelation: string | null;
  body: Localized<string>;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: Date;
};
export async function submitCondolence(input: SubmitCondolenceInput): Promise<{ ok: boolean }>;
export async function listApprovedFor(memberId: string, opts?: { limit?: number; offset?: number }): Promise<Condolence[]>;
export async function listPending(): Promise<Condolence[]>;
export async function moderate(id: number, action: 'approve' | 'reject', actorId: string): Promise<void>;

// i18n.ts
export type Locale = 'vi' | 'en';
export type Localized<T = string> = Partial<Record<Locale, T>>;
export function pickLocale<T>(v: Localized<T> | undefined, lang: Locale, fallback?: T): T | undefined;
export function getLocale(astro: { url: URL; cookies: AstroCookies }): Locale;
export function t<K extends NestedKey<Catalog>>(key: K, lang: Locale, vars?: Record<string, string | number>): string;

// og-memorial.ts
export async function renderMemorialOgImage(memberId: string, lang: Locale): Promise<{ buffer: Buffer; etag: string }>;

// cron-auth.ts
export function requireCronSecret(req: Request): Response | null;
```

### 5.3 Caching

- `getActiveBanner()` + `getDeceasedMembers()` cache in-memory 60s như pattern `settings.ts` đã có
- Invalidate khi `memorial.*` setting save hoặc deceased member add/remove qua `revalidate()` exported function
- Browser cache: memorial pages SSR no-cache, OG image CDN 24h

---

## 6. Pages + components

### 6.1 Public route map

```
src/pages/
├── memorial/
│   └── [id].astro              SSR per-deceased member
├── altar.astro                  SSR + cache 60s
├── api/
│   ├── incense.ts               POST thắp hương
│   └── condolence.ts            POST submit + GET listing paged
└── og/
    └── memorial/[id].png.ts     dynamic OG image, CDN cache 24h
```

### 6.2 Astro components

```
src/components/astro/
├── MemorialBanner.astro       homepage banner ≤7d trước giỗ
├── MemorialHero.astro         di ảnh + tên + năm sinh-mất
├── MemorialBio.astro          long-form serif + drop cap gold-2
├── MemoriesSection.astro      "Kỷ niệm vui về Cụ" — celebration of life
├── MemorialQuotes.astro       "Lời dặn" pull-quote treatment
├── MemorialTraditions.astro   "Mâm cỗ truyền thống" link traditions
├── AltarTier.astro            1 hàng gen-grouped trong /altar
├── AncestorTile.astro         1 di ảnh trong altar grid
└── LotusSeal.astro            canonical seal: lotus + tên dòng họ Quốc ngữ
```

### 6.3 React islands

```
src/components/react/
├── IncenseButton.tsx          form + counter + ember glow + soft chime
├── CondolenceForm.tsx         submit form (name + relation + body) → toast
└── CondolenceBook.tsx         list approved + sort + paginate
```

### 6.4 Memorial page composition

`/memorial/[id]` top-to-bottom:

1. **MemorialHero** — di ảnh sepia warm centered max-w-380, ratio 4:5, viền giấy dó mảnh `1px solid color-gold-2/30`, tên Lora `--text-5xl` italic, năm sinh-mất `text-sm tracking-wider` muted, paper background clean
2. **Born/Died lockup** informative — show cả dương + âm: "Mất ngày 15/3/1987 (Rằm tháng 2 Âm năm Mậu Thìn)"
3. **MemorialBio** — long-form serif Lora `--text-lg`, drop cap gold-2 (KHÔNG vermilion), max-w-prose, BlossomDivider giữa các đoạn
4. **MemoriesSection** — celebration of life, 2-3 ảnh đời thường + câu chuyện ngắn, tươi sáng
5. **IncenseButton** — sticky right desktop / inline mobile, "Thắp một nén tâm hương" + "47 người đã tưởng nhớ"
6. **MemorialQuotes** — pull-quote serif italic, "Lời dặn của Cụ"
7. **MemorialTraditions** — "Cụ thường làm món..." link traditions
8. **Photo gallery** — masonry `react-photo-album` filter theo member
9. **CondolenceBook** — "Lời tưởng nhớ" cards paper warm + nút mở CondolenceForm
10. **Footer**: anniversary lookahead 5 năm + Zalo share button

### 6.5 Altar page composition

```
┌─────────────────────────────────────┐
│  HERO: paper cream + soft daylight  │
│  "Bàn thờ tổ tiên"                  │
│  LotusSeal subtle                   │
│  Nếu có giỗ hôm nay: pill nhỏ      │
├─────────────────────────────────────┤
│ TIER 1 (cụ kỵ — gen 1-2)            │
│  [DiAnh1] [DiAnh2] [DiAnh3]         │
│  ─── gỗ nâu nhẹ divider ───         │
│ TIER 2 (ông bà — gen 3-4)           │
│  [DiAnh4] [DiAnh5] ...              │
│  ─── divider ───                    │
│ TIER 3 (cha mẹ — gen 5+)            │
│  [DiAnh6] ...                       │
└─────────────────────────────────────┘
```

- Background: paper cream sáng + soft daylight gradient từ trên xuống (KHÔNG dim)
- Tier divider: CSS gradient gỗ nâu nhẹ, KHÔNG photo gỗ heavy
- AncestorTile: ratio 4:5 sepia, viền giấy dó mảnh, hover scale 1.03 + warm gold glow (KHÔNG vermilion ring nhấp nháy)
- Tile có giỗ hôm nay → glow gold ấm liên tục (subtle)
- Click → navigate `/memorial/[id]` full page (KHÔNG modal)

### 6.6 Homepage banner

```
🌸 Còn 5 ngày đến giỗ Cụ Nguyễn Văn Tổ — Tưởng niệm →    [×]
```

- Slim 1-line, gold-2 background `bg-[--color-gold-2]/15`, border-bottom mảnh
- `motion` slide-down từ top 300ms khi mount
- Dismiss × icon → cookie 24h theo `member_id + anniversary_year`

---

## 7. Admin layer

### 7.1 Route map

```
src/pages/admin/
├── memorial/
│   ├── index.astro              dashboard hub
│   ├── anniversaries.astro      lịch giỗ 12 tháng tới
│   └── alerts-log.astro         log cron đã gửi email
├── condolences.astro            moderation queue
├── incense/
│   └── [member_id].astro        log thắp hương per-member
├── members/
│   └── [id].astro               (existing, +fieldset 8 "Tưởng niệm")
└── cron/
    └── anniversary-alerts.ts    POST endpoint, bearer-guarded
```

### 7.2 Dashboard hub `/admin/memorial`

- 4 stat cards: tổ tiên trên bàn thờ · lời chờ duyệt · lời đã duyệt · tâm hương đã dâng
- "Giỗ sắp tới (≤30 ngày)" list cards với manual trigger button
- "Lời tưởng nhớ chờ duyệt" link tới moderation queue
- Recent activity: filter audit_log theo entity prefix

### 7.3 Anniversaries `/admin/memorial/anniversaries`

- Table 12 tháng tới + calendar view (shadcn `<Calendar>`) toggle
- Cột: Member · Ngày dương · Ngày âm · Số ngày tới · Email status (T-7/T-1/today)
- Filter: branch + chi nhánh + năm
- Per-row action: xem trang tưởng niệm, gửi email T-7 ngay (manual), tạm tắt alert
- Export CSV

### 7.4 Alerts log `/admin/memorial/alerts-log`

- Read-only table của `family.anniversary_alerts`
- Filter: member + alert_type + year
- Cột: thời gian · loại · recipients (count + expand) · status

### 7.5 Condolences moderation `/admin/condolences`

- shadcn Tabs (Pending / Approved / Rejected) với count badge
- Row click → Sheet drawer hiện full body + di ảnh member context
- Bulk approve/reject qua checkbox
- Filter by member (cmdk autocomplete)
- Search trong body (Postgres `to_tsvector`)
- Mỗi action ghi audit_log

### 7.6 Incense log `/admin/incense/[member_id]`

- Read-only log per member, default current anniversary year
- Year picker
- Cột: visitor_name · message · ip_hash · created_at
- Bulk delete (xoá spam)
- Anonymize action: xoá ip_hash + visitor_name → "Người tưởng nhớ ẩn danh"
- Export CSV

### 7.7 MemberForm fieldset 8

Chỉ render khi `death_date IS NOT NULL`:

```
┌─ Tưởng niệm ─────────────────────────────────┐
│ ☑ Bật trang tưởng niệm /memorial/[id]        │
│ Ngày giỗ sử dụng: ⦿ Âm  ○ Dương  ○ Cả hai   │
│ Ngày âm tự động: Rằm tháng 2 Mậu Thìn        │
│   [Sửa thủ công]                              │
│ [Xem trang tưởng niệm ↗] [Xem OG preview]    │
└───────────────────────────────────────────────┘
```

### 7.8 Sidebar nav

Thêm group "TƯỞNG NIỆM" vào `src/components/admin/Sidebar.astro`:

```
TƯỞNG NIỆM
  🪷 Tổng quan          /admin/memorial
  📅 Lịch giỗ           /admin/memorial/anniversaries
  💬 Lời tưởng nhớ      /admin/condolences  [badge: 3]
  📨 Log gửi alert      /admin/memorial/alerts-log
```

Badge fetch lúc Sidebar SSR, cache 30s.

### 7.9 Settings UI

Thêm category **"Tưởng niệm"** vào `/admin/settings` với 6 keys (xem section 4 settings table).

### 7.10 Permission matrix

| Action | admin | branch_editor | editor | public |
|---|---|---|---|---|
| Xem `/admin/memorial/*` | ✅ | ✅ (chi nhánh) | ❌ | ❌ |
| Moderate condolences | ✅ | ✅ (chi nhánh) | ❌ | ❌ |
| Toggle `memorial_enabled` | ✅ | ✅ (chi nhánh) | ❌ | ❌ |
| Trigger manual email | ✅ | ❌ | ❌ | ❌ |
| Delete incense events | ✅ | ❌ | ❌ | ❌ |
| Submit incense (public) | ✅ | ✅ | ✅ | ✅ |
| Submit condolence | ✅ | ✅ | ✅ | ✅ |

Gate qua middleware existing — extend pattern.

---

## 8. Cron + email

### 8.1 Cron endpoint flow

`POST /admin/cron/anniversary-alerts` (idempotent):

```
1. requireCronSecret(req)
2. const today = startOfDayHCM()
3. const deceased = await getDeceasedMembers()
4. for each member, for each [thisYear, nextYear]:
     compute anniversary.solarDate
     days = daysBetween(today, anniversary.solarDate)
     for each trigger in alert_days_before (e.g. [7,1,0]):
       if days === trigger:
         alertType = '7'→'t-7', '1'→'t-1', '0'→'today'
         exists = SELECT FROM anniversary_alerts WHERE (member, type, year) UNIQUE
         if !exists:
           recipients = getAdminAndBranchEditors(member.branch)
           sendAnniversaryEmail({ member, anniversary, recipients })
           INSERT INTO anniversary_alerts (...)
5. return { processed, sent, skipped }
```

### 8.2 Coolify scheduled task

Setup qua Coolify panel UI:
- Schedule: `0 6 * * *` (06:00 daily)
- Timezone: `Asia/Ho_Chi_Minh`
- Command: `curl -X POST -H "Authorization: Bearer ${CRON_SECRET}" https://family.huynhvantuan.net/admin/cron/anniversary-alerts`

### 8.3 Email templates

```
src/emails/
├── AnniversaryT7.tsx      "Còn 7 ngày tới giỗ Cụ X"
├── AnniversaryT1.tsx      "Ngày mai là giỗ Cụ X"
├── AnniversaryToday.tsx   "Hôm nay là giỗ Cụ X"
└── shared/
    ├── EmailLayout.tsx    paper warm + lotus seal + footer
    └── MemberCard.tsx     di ảnh sepia + tên + năm sinh-mất
```

- `react-email/render` → HTML → nodemailer SMTP
- Tone ấm informative, KHÔNG dramatic
- CTA "Xem trang tưởng niệm" → `/memorial/[id]`
- Hiển thị cả lịch âm + dương
- Recipient locale: từ `app_users.preferred_lang`

### 8.4 Failure mode

- Email send fail → catch, log audit, KHÔNG insert vào `anniversary_alerts` → cron tomorrow retry
- Cron miss → admin có manual trigger button trong `/admin/memorial/anniversaries`

---

## 9. i18n implementation

### 9.1 Catalog file structure

```
src/i18n/
├── index.ts        Locale type, t(), pickLocale(), getLocale()
├── vi.ts           VN catalog (default, complete)
└── en.ts           EN catalog (placeholder; fill dần khi enable EN)
```

### 9.2 Catalog shape

```ts
// src/i18n/vi.ts
export const vi = {
  memorial: {
    pageTitle: 'Tưởng niệm {name}',
    incenseButton: 'Thắp một nén tâm hương',
    incenseCount: '{count} người đã tưởng nhớ',
    incenseSuccess: 'Đã dâng tâm hương 🌸',
    incenseRateLimit: 'Cảm ơn bạn — hãy quay lại sau ít phút',
    condolenceTitle: 'Lời tưởng nhớ',
    condolenceCta: 'Để lại lời tưởng nhớ',
    condolenceEmpty: 'Chưa có lời tưởng nhớ. Hãy là người đầu tiên 🌸',
    condolencePending: 'Lời chia sẻ đã gửi, sẽ hiện sau khi quản trị duyệt 🙏',
    bornDied: 'Sinh: {birth} · Mất: {death}',
    altarTitle: 'Bàn thờ tổ tiên',
    bannerDays: 'Còn {days} ngày đến giỗ {name}',
    bannerToday: 'Hôm nay là ngày giỗ {name}',
    kicker: 'Tưởng niệm',
    cta: 'Xem trang tưởng niệm',
  },
  common: { back: 'Quay lại', loading: 'Đang tải...', error: 'Đã có lỗi' },
} as const;
```

### 9.3 Resolution chain

```ts
getLocale(astro) {
  ?lang=vi|en  → cookie family_lang=vi|en  → 'vi' (default)
}
```

### 9.4 Type-safe keys

`NestedKey<Catalog>` template literal type → typo at build time fails type check.

---

## 10. OG image

Endpoint: `/og/memorial/[id].png.ts`

```ts
import { ImageResponse } from '@vercel/og';
import { getMemorialMember } from '@/lib/memorial';
import { pickLocale, getLocale, t } from '@/i18n';

export const prerender = false;

export async function GET({ params, request, cookies, url }) {
  const lang = getLocale({ url, cookies });
  const m = await getMemorialMember(params.id);
  if (!m) return new Response('Not found', { status: 404 });

  return new ImageResponse(
    (
      <div style={paperBackgroundStyle}>
        <div style={portraitFrameStyle}>
          <img src={m.photoUrl} style={sepiaPortraitStyle} />
        </div>
        <div style={textColumnStyle}>
          <div style={kickerStyle}>{t('memorial.kicker', lang)}</div>
          <div style={nameSerifStyle}>{m.fullName}</div>
          <div style={datesStyle}>{pickLocale(m.bornDiedLine, lang)}</div>
          <div style={mottoStyle}>🌸 {t('memorial.cta', lang)}</div>
        </div>
        <div style={sealContainerStyle}>
          <LotusSvgInline />
          <div style={sealTextStyle}>Họ Nguyễn</div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
      fonts: [
        { name: 'Lora', data: loraSerif, weight: 600 },
        { name: 'BeVietnamPro', data: beVietnam, weight: 400 },
        { name: 'DancingScript', data: dancingScript, weight: 600 },
      ],
      headers: { 'cache-control': 'public, max-age=86400, s-maxage=86400, immutable' },
    }
  );
}
```

**Style:**
- Paper cream `#FAF6EC` + watercolor texture inline SVG
- Di ảnh sepia warm centered-left, ratio 4:5, viền giấy dó gold-2
- Serif name Lora 64px right column
- Năm sinh-mất `text-2xl` muted ink/60
- Seal: Lotus SVG + "Họ Nguyễn" Dancing Script (KHÔNG chữ Hán per D24)

**Font loading:** fetch từ `/public/fonts/*.ttf` lúc module load → Buffer cache module-level (Astro SSR persistent process).

---

## 11. Library stack (proven over custom)

| Job | Lib | Bundle |
|---|---|---|
| Lunar VN | `lunar-typescript` | ~30KB |
| Animation | `motion` (framer-motion v11) | ~30KB tree-shaken |
| OG image | `@vercel/og` (Satori) | ~40KB |
| Email | `react-email` + `nodemailer` | ~50KB |
| Date picker | shadcn `<Calendar>` (Radix + react-day-picker) | đã có |
| Form | `react-hook-form + zod` | đã có |
| Toast | `sonner` | đã có |
| Markdown bio | `marked` | đã có |
| Image filter sepia | CSS native `filter:sepia()` | 0 |
| Audio chime (optional) | `use-sound` (Howler.js) | ~10KB |
| Soft confetti khi thắp hương xong | `canvas-confetti` (subtle gold mode) | ~12KB |

---

## 12. Testing strategy

### Unit (vitest)

```
src/lib/lunar.test.ts             golden table 20 ngày giỗ thật
src/lib/anniversary.test.ts       năm nhuận âm, tháng nhuận, today=anniversary
src/lib/i18n.test.ts              t() vars, pickLocale fallback, missing key
src/lib/incense.test.ts           rate-limit window, ip_hash deterministic
src/lib/og-memorial.test.ts       PNG bytes valid, font load OK
```

### Integration

```
scripts/smoke-memorial.mjs        curl all routes 200, POST endpoints 200/429 expected
```

### E2E manual checklist (iPhone real device)

- Memorial page LCP < 1.5s
- IncenseButton click → ember glow → counter +1 → toast
- CondolenceForm validation + submit → pending toast
- Banner dismissal cookie persists
- Altar tile click → memorial navigation
- Email alert thật từ cron (manual trigger)

### A11y

- `axe-core` qua Playwright trên 3 page (memorial, altar, condolences moderation)
- Keyboard nav full
- prefers-reduced-motion respect (motion lib auto)
- aria-live cho counter increment
- Color contrast WCAG AA

### CI guard

`scripts/check-no-cjk.mjs` (D26):

```js
// grep CJK Unified [一-鿿] trong src/**/*.{astro,tsx,ts}
// fail nếu match (whitelist node_modules)
```

---

## 13. Rollout plan — 5 phases

### Phase M1 — Schema + lib foundation (1 day)
- Migration `0017_memorial.sql`
- 8 lib files
- Unit tests
- Settings seed 6 keys
- **Ship gate:** unit tests xanh, không affect public site

### Phase M2 — Public memorial page (2 days)
- `/memorial/[id]` + 5 Astro components + 3 React islands
- `/api/incense` + `/api/condolence`
- OG image route
- i18n catalog vi.ts đầy đủ memorial keys (~30 keys)
- **Ship gate:** open `/memorial/g3-1` đẹp, thắp hương 1 lần thành công

### Phase M3 — Altar + banner (1 day)
- `/altar` + `<MemorialBanner>` mount homepage
- AltarTile glow logic
- **Ship gate:** `/altar` thấy bàn thờ, banner xuất hiện cho member có giỗ ≤7d

### Phase M4 — Admin layer (2 days)
- 5 admin route + sidebar group + MemberForm fieldset 8
- Condolence moderation queue
- Settings UI category
- **Ship gate:** admin moderate được, toggle `memorial_enabled` per member

### Phase M5 — Cron + email (1 day)
- `/admin/cron/anniversary-alerts` + bearer auth
- 3 react-email templates
- Coolify scheduled task setup
- Email send test
- **Ship gate:** cron chạy 1 sáng, email vào hộp thư admin đẹp

**Total: ~7 dev-days**

---

## 14. Risks + mitigations

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| `lunar-typescript` sai năm nhuận | M | H | Golden test 20 ngày thật; admin override `death_date_lunar` JSONB (D29) |
| Spam thắp hương / sổ tang | M | M | Rate-limit IP-hash 5/h; CAPTCHA fallback `hcaptcha`; admin bulk-anonymize (D30) |
| OG image render fail | L | M | Try/catch + fallback static `og-memorial-default.png` |
| Cron miss | L | H | Idempotency log + manual trigger button; audit log mọi run |
| Vô tình bật memorial cho người sống | L | H | Schema check `death_date IS NOT NULL`; UI fieldset chỉ hiện khi có death_date |
| i18n key thiếu khi enable EN | M | M | t() fallback về key string; CI check (defer) |
| Email font Vietnamese render lỗi | L | M | react-email font test; Vietnamese subset Be Vietnam Pro |
| Cô chú không quen UX | M | H | M2 ship → tester thật qua Zalo; tutorial inline; help link |
| Religious sensitivity (Phật vs Công giáo) | M | M | Setting `memorial.calendar_default` per family; copy trung tính |
| Insert chữ Hán lỡ tay | M | H | CI grep guard `check-no-cjk.mjs` (D26) |

---

## 15. Acceptance criteria

- [ ] `/memorial/[id]` SSR < 500ms TTFB cho 1 member có 50 condolences
- [ ] OG image cold render < 800ms, cached < 100ms
- [ ] Cron idempotent (chạy 2 lần = 1 email)
- [ ] Lunar conversion: golden test 20 ngày thật pass 100%
- [ ] Zero chữ Hán trong source (CI `check-no-cjk` pass)
- [ ] WCAG AA contrast all memorial pages
- [ ] Keyboard nav full memorial + altar + moderation queue
- [ ] i18n: `?lang=en` đổi UI strings (catalog EN sẽ fill dần)
- [ ] Mobile iPhone Safari: hero render, IncenseButton dialog không scroll-lock leak
- [ ] Email render đẹp Gmail web + iOS Mail
- [ ] Admin moderation 1 click duyệt + audit log entry chính xác

---

## 16. Out of scope (defer)

- Lễ Vu Lan / Thanh Minh / Tết mass-rite features
- Voice/audio archives
- Văn khấn (ritual liturgy) library
- Public user registration cho khách thắp hương
- Realtime WebSocket cho counter
- 3D altar / WebGL particle khói
- Multi-language EN translation đầy đủ ngay (chỉ ready, không fill catalog EN)
- Heritage book PDF export (separate design doc)
- Family tree v2 calligraphy scroll (separate design doc)

---

## 17. Open questions resolved during brainstorm

| # | Question | Answer |
|---|---|---|
| Q1 | Sổ tang auth: anonymous hay đăng ký? | Anonymous + name + admin moderation |
| Q2 | Phạm vi `/altar`: 3-4 đời hay tất cả? | Tất cả deceased, group theo gen, scroll dài OK |
| Q3 | Memorial banner chỉ homepage hay sticky cả site? | Chỉ homepage + altar |
| Q4 | "Thắp hương" persistence: mãi mãi hay reset/year? | Per-anniversary year |
| Q5 | Email recipients: chỉ admin+branch_editor hay all? | Chỉ admin + branch_editor liên quan |
| Q6 | Audio chime default | OFF (per-session opt-in) |
| Q7 | Soft confetti khi thắp hương | ON 1.5s subtle gold, prefers-reduced-motion respect |
| Q8 | Altar generation cap | Show all, group theo gen |
| Q9 | Multi-language scope | i18n-ready, EN catalog placeholder, full translation defer |

---

## 18. References

- `DESIGN.md` — Phase 1 foundation
- `DESIGN-PHASE-2-ADMIN.md` — Phase 2 admin (auth, RLS, schema)
- `DESIGN-MEDIA-V2.md` — media v2 patterns (shadcn, masonry, lightbox)
- Memory: `feedback_family_memorial_tone.md` (warm × tradition aesthetic)
- Memory: `feedback_family_no_chinese_chars.md` (zero Hán rule)
- Memory: `feedback_family_i18n_ready.md` (i18n-ready từ đầu)
- Memory: `feedback_family_naming_convention.md` (EN tech, VN content)
- Memory: `feedback_prefer_proven_libs.md` (lib over custom)
