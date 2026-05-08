# DESIGN — Heritage Book PDF (Gia Phả In Được)

**Status:** brainstorm complete (2026-05-08), implementation pending
**Predecessors:** `DESIGN.md`, `DESIGN-PHASE-2-ADMIN.md`, `DESIGN-MEDIA-V2.md`, `DESIGN-MEMORIAL.md`, `DESIGN-NOTIFICATIONS.md`
**Approach:** Lean — reuse existing data + libs; `@react-pdf/renderer` JSX
**Effort estimate:** ~2.5 dev-days, 7 phases (HB1-HB7)

---

## 1. Understanding Lock

### What
Trang admin `/admin/heritage-book` generate PDF 30-50 trang in được, leverage 100% data hiện có (members + bios + photos + quotes + traditions + dates). Single download per request, no caching.

### Why
- Site đang digital-only → cô chú 70+ không mở browser
- PDF book cầm tay + đặt bàn thờ + mang đi đám giỗ làm quà = artifact vật lý cảm xúc
- Differentiation moat: zero Tây site (Geni, FamilySearch, MyHeritage) có
- Leverage 100% data đã có; 0 schema mới

### Who
- **Admin/branch_editor** generate + download
- Public share qua Zalo defer (URL snapshot Phase 2)
- In-print: cô chú gửi file in tại nhà sách hoặc tự in tại nhà

### Constraints
- Astro 6 SSR + Node adapter (đã có)
- Tech naming EN, content VN (per `feedback_family_naming_convention`)
- i18n-ready: PDF nhận `lang` param, default `vi`
- Lib over hand-roll (per `feedback_prefer_proven_libs`)
- ZERO Hán-Nôm trong assets/text (per `feedback_family_no_chinese_chars`)
- Tone: warm × tradition × modern (per `feedback_family_memorial_tone`)

### Non-goals (defer)
- ❌ Fold-out A3 lineage tree (mvp = A4 portrait only)
- ❌ Văn khấn library page
- ❌ Custom print profiles (margin/bleed/CMYK — print shop handles)
- ❌ Multi-volume support (1 book = 1 family)
- ❌ Editable PDF / form fields
- ❌ URL snapshot share

### Non-functional

| Aspect | Target |
|---|---|
| PDF generate latency | < 5s for 30-page book (10 members + 20 photos) |
| File size | < 8 MB target, < 15 MB hard cap |
| Scale | ≤ 100 members per book; pagination not auto-overflow optimized |
| Privacy | Filter by `status='published'`; admin can opt-include drafts |
| Maintenance | Each PDF page = 1 React component file ≤ 200 LOC; styles share via styles.ts |
| A11y | PDF tagged for screen readers (react-pdf default OK) |

---

## 2. Decision Log

| # | Decision | Alternatives | Why |
|---|---|---|---|
| HB1 | `@react-pdf/renderer` | Puppeteer HTML→PDF, jsPDF | JSX-native, predictable layout, no browser runtime, fonts work |
| HB2 | A4 portrait, 30-50 pages | A5 / Letter / B5 | VN print standard; fold-out A3 tree defer |
| HB3 | Fonts via `Font.register` TTF subset | System fonts | Vietnamese diacritics rendering correct |
| HB4 | Reuse `og-fonts.ts` Vietnamese subset | New font assets | Already proven for OG image; same Lora + BeVietnamPro + DancingScript |
| HB5 | Photos: sepia via opacity overlay layer | Pre-process source | Keep source untouched; filter at render |
| HB6 | Single download per request, no caching | Pre-generate + cache 24h | Data changes; PDF small enough to regenerate |
| HB7 | Filter members `status='published'` only by default | Include drafts | Drafts not ready for print; toggle to include |
| HB8 | Admin UI: option toggles (drafts / photos / traditions / album) | All-or-nothing | Flexibility per use case |
| HB9 | KHÔNG fold-out A3 lineage tree (mvp) | Auto-rotate page | Layout complexity; defer |
| HB10 | Lineage chart = simple SVG tree on A4 | d3 layout / image | Inline render via react-pdf SVG primitives |
| HB11 | Markdown body via existing `renderMarkdown` → strip HTML for PDF | New md→pdf parser | Reuse; PDF doesn't support HTML strings, so render markdown to plain text + structural cues |
| HB12 | Each member = 2-page spread (portrait left, bio right) | 1-page condensed | More breathing room, allows photo + bio + lời dặn |
| HB13 | Photos in album section: max 32, prefer `featured=true` then by `year DESC` | All photos | Manage page count; admin-controllable later |
| HB14 | i18n via `lang` query param, default vi | EN-only | Future-proof per `feedback_family_i18n_ready` |
| HB15 | GET endpoint streams PDF, no DB write | Save snapshot to storage | mvp simple; snapshot defer |

---

## 3. Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                     ADMIN SURFACE                                   │
│  /admin/heritage-book — preview + options form + Download button    │
└────────────────────────────────────────────────────────────────────┘
                              │
                              ▼ GET /admin/heritage-book.pdf?<options>
┌────────────────────────────────────────────────────────────────────┐
│              ENDPOINT: src/pages/admin/heritage-book.pdf.ts         │
│  - Auth check (admin/branch_editor)                                 │
│  - Parse options (?include_drafts=&photos=&...&lang=)               │
│  - Fetch all data via existing getMembers/getQuotes/etc.            │
│  - Build BookData object                                            │
│  - renderToStream(<HeritageBook data={bookData} />)                 │
│  - Pipe stream to Response with content-disposition: attachment     │
└────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────────┐
│              LIB: src/lib/heritage-book/                            │
│  styles.ts        shared StyleSheet (paper, fonts, motifs)         │
│  fonts.ts         Font.register() Vietnamese-subset TTF             │
│  data.ts          BookData type + buildBookData() loader            │
│  index.tsx        <HeritageBook> root <Document> wiring all pages   │
│  pages/                                                             │
│    Cover.tsx                                                        │
│    Foreword.tsx                                                     │
│    TableOfContents.tsx                                              │
│    LineageChart.tsx     (compact A4 tree SVG)                       │
│    MemberSpread.tsx     (2-page: portrait + bio)                    │
│    PhotoMosaic.tsx                                                  │
│    TraditionPage.tsx                                                │
│    QuotesPage.tsx                                                   │
│    CalendarPage.tsx     (lịch giỗ deceased members)                 │
│    BackCover.tsx                                                    │
│  motifs/                                                            │
│    LotusSeal.tsx        (PDF-friendly Lotus SVG primitive)          │
│    BlossomDivider.tsx                                               │
└────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────────┐
│                    DATA SOURCES                                      │
│  family.members (filter status=published unless toggle)            │
│  family.photos (featured=true OR all if toggle)                     │
│  family.traditions                                                  │
│  family.quotes                                                      │
│  family.dates (lễ giỗ deceased)                                     │
│  family.settings (site identity, surname, motto, established)       │
└────────────────────────────────────────────────────────────────────┘
```

---

## 4. PDF page composition

### Cover (1 page)
- Background: cream paper texture (full bleed)
- Top: kicker "GIA PHẢ" tracking-wider tiny caps gold-2
- Center: brand surname "Họ Nguyễn" Dancing Script 96pt gold-2
- Below: subtitle "Cây phả hệ dòng họ" Lora italic
- Lotus medallion SVG large, sepia-tinted
- Bottom: established year + city + edition year (e.g. "Quảng Ngãi · 1928 — 2026")
- Inner border: thin double-line ornate

### Foreword (1-2 pages)
- Page header: kicker "Lời nói đầu" gold-2 small
- Body: motto pull-quote serif italic + intro paragraph (auto-generated from `site.settings`)
- BlossomDivider mid-page
- Sub-paragraph: thông tin về cuốn sách (in lần thứ N, năm phát hành, người sưu tầm)

### Table of Contents (1 page)
- Heading "Mục lục" Lora 32pt
- Auto-generated entries: Lời nói đầu · Sơ đồ phả hệ · Tiểu sử thành viên · Album ảnh · Truyền thống · Lời dặn · Lịch giỗ
- Right-aligned page numbers tabular-nums
- Dotted leader between title and number

### Lineage Chart (1 page)
- A4 portrait, render members as SVG tree
- Top: tổ (founder) → next gen below → leaf descendants at bottom
- Each node: name (compact font) + birth-year only (death year hidden for living)
- Connector: thin gold-2 line, 90° elbow joints
- Members > 16 in a single tree → fallback simplified text list
- Footer: "Sơ đồ tóm tắt — chi tiết xem các trang sau"

### Member Spread (2 pages per member)

**Left page:**
- Top kicker: "Đời thứ N" tracking-wider gold-2
- Centered: chân dung sepia 4:5, viền giấy dó mảnh, max 280pt × 350pt
- Below portrait: full name Lora italic 28pt
- Subline: "Vai vế: Tộc trưởng · Branch: Nội"
- Bottom: born/died lockup
  - Sinh DD/MM/YYYY (lunar)
  - Mất DD/MM/YYYY (lunar)

**Right page:**
- Top: kicker "Tiểu sử" gold-2
- Drop cap gold-2 first letter (Lora 56pt)
- Body: bio long-form, render markdown → plain text + paragraph breaks. ~ 350-450 words/page
- Pull-quote section if member has quotes:
  - Border-left gold-2
  - Lora italic 14pt
  - Caption "— Lời {tên}"
- Bottom: BlossomDivider

### Photo Mosaic (4-8 pages)
- 6 photos per page in 2×3 grid, sepia filter
- Each photo: caption serif italic 9pt below
- Filter by year DESC, prefer `featured=true`
- Page header: "Album · Năm 2020"
- Skip pages if no photos

### Tradition Page (1 page each, 4-6 traditions)
- Top: tradition name Lora 24pt + category badge
- Sub: ảnh tradition.image sepia 16:9 (if exists), max 280pt height
- Body: rendered markdown body (bullet for ingredients/steps if traditional food)
- Footer: BlossomDivider + tags

### Quotes Page (2-4 pages)
- Each quote = pull-quote block, 3-4 per page
- Vermilion drop quote mark big
- Quote text Lora italic 16pt
- Author Lora 11pt + relationship if member ref

### Calendar Page (1-2 pages)
- Heading "Lịch giỗ"
- Sub: "Ngày giỗ tổ tiên trong năm + lễ kỷ niệm gia đình"
- Per-row:
  - Day pill (left): tabular-nums big number
  - Center: name + relation
  - Right: ngày âm "Rằm tháng 2 năm Mậu Thìn" italic
- Sort by month (1 → 12)

### Back Cover (1 page)
- Lotus seal centered
- Surname Dancing Script
- URL `family.huynhvantuan.net` mono small
- Year edition
- Soft cream background

---

## 5. Lib structure (detail)

### `src/lib/heritage-book/styles.ts`

```ts
import { StyleSheet } from "@react-pdf/renderer";

export const COLORS = {
  paper: "#FAF6EC",
  cream: "#FFFCF5",
  ink: "#3A2E1A",
  ink2: "#5A4A30",
  ink3: "#9C8A6A",
  gold: "#C9A35A",
  gold2: "#A8853F",
  vermilion: "#9B2E28",
  border: "rgba(168, 133, 63, 0.30)",
} as const;

export const PAGE_PADDING = 48;

export const styles = StyleSheet.create({
  page: {
    backgroundColor: COLORS.paper,
    padding: PAGE_PADDING,
    fontFamily: "BeVietnamPro",
    fontSize: 11,
    color: COLORS.ink,
    lineHeight: 1.55,
  },
  pageNumber: {
    position: "absolute",
    bottom: 24,
    right: PAGE_PADDING,
    fontSize: 8,
    color: COLORS.ink3,
  },
  kicker: {
    fontSize: 9,
    fontFamily: "BeVietnamPro",
    fontWeight: 600,
    color: COLORS.gold2,
    letterSpacing: 2.5,
    textTransform: "uppercase",
    marginBottom: 12,
  },
  display: {
    fontFamily: "Lora",
    fontStyle: "italic",
    fontSize: 32,
    color: COLORS.ink,
    lineHeight: 1.15,
  },
  bodySerif: {
    fontFamily: "Lora",
    fontSize: 11.5,
    lineHeight: 1.65,
    color: COLORS.ink,
  },
  blockquote: {
    borderLeftWidth: 2,
    borderLeftColor: COLORS.gold2,
    paddingLeft: 10,
    fontStyle: "italic",
    color: COLORS.ink2,
    marginVertical: 8,
  },
  sealText: {
    fontFamily: "DancingScript",
    fontSize: 24,
    color: COLORS.gold2,
  },
});
```

### `src/lib/heritage-book/fonts.ts`

Reuse `og-fonts.ts` font URLs but register via react-pdf:

```ts
import { Font } from "@react-pdf/renderer";

let registered = false;

export async function ensureFonts(): Promise<void> {
  if (registered) return;
  Font.register({
    family: "Lora",
    fonts: [
      { src: "https://fonts.gstatic.com/s/lora/v35/0QI6MX1D_JOuGQbT0gvTJPa787weuxJBkqg.ttf", fontWeight: 600 },
      { src: "https://fonts.gstatic.com/s/lora/v35/0QIvMX1D_JOuMw_HLD0iyOxZ4FWEPNB6peM.ttf", fontWeight: 400, fontStyle: "italic" },
    ],
  });
  Font.register({
    family: "BeVietnamPro",
    fonts: [
      { src: "https://fonts.gstatic.com/s/bevietnampro/v11/QdVPSTAyLFyeg_IDWvOJmVES_HRUBX8YYbAjbHaXE2QyOL5W.ttf", fontWeight: 400 },
      { src: "https://fonts.gstatic.com/s/bevietnampro/v11/QdVPSTAyLFyeg_IDWvOJmVES_HRUBX8YxbsjbHaXE2QyOL5W.ttf", fontWeight: 600 },
    ],
  });
  Font.register({
    family: "DancingScript",
    fonts: [
      { src: "https://fonts.gstatic.com/s/dancingscript/v25/If2cXTr6YS-zF4S-kcSWSVi_swLvBtskOXTqNcgWor1faisXX0c.ttf", fontWeight: 600 },
    ],
  });
  registered = true;
}
```

Note: react-pdf supports remote font URLs natively (downloads + caches at render time). No need to embed via fetch+ArrayBuffer like Satori.

### `src/lib/heritage-book/data.ts`

```ts
export interface BookData {
  surname: string;
  brand: { vi: string; en: string };
  hometown: string;
  motto: string;
  established: number;
  publicationYear: number;
  members: ClientMember[];          // sorted gen → birth_order
  deceasedMembers: MemorialMember[]; // for calendar
  quotes: QuoteEntry[];
  traditions: TraditionEntry[];
  photos: PhotoData[];               // sorted year DESC, featured first
}

export async function buildBookData(opts: {
  includeDrafts: boolean;
  includePhotos: boolean;
  includeTraditions: boolean;
  includeAlbum: boolean;
  lang: "vi" | "en";
}): Promise<BookData> {
  // Fetch via existing getMembers/getQuotes/getTraditions/getPhotos/getDates
  // Filter by status, sort, return.
}
```

---

## 6. Admin UI — `/admin/heritage-book`

```
┌──────────────────────────────────────────────────────────┐
│ Heritage Book                                             │
├──────────────────────────────────────────────────────────┤
│ Tạo cuốn gia phả PDF in được, 30-50 trang A4.            │
│                                                           │
│ ┌─ Tuỳ chọn nội dung ──────────────────────────────────┐ │
│ │ ☑ Bao gồm thành viên đã xuất bản (mặc định)         │ │
│ │ ☐ Bao gồm thành viên nháp (status='draft')          │ │
│ │ ☑ Bao gồm Album ảnh (4-8 trang)                     │ │
│ │ ☑ Bao gồm Truyền thống                              │ │
│ │ ☑ Bao gồm Lời dặn                                    │ │
│ │ ☑ Bao gồm Lịch giỗ                                   │ │
│ │                                                       │ │
│ │ Ngôn ngữ: [Tiếng Việt ▼]                            │ │
│ └──────────────────────────────────────────────────────┘ │
│                                                           │
│ ┌─ Thống kê ──────────────────────────────────────────┐ │
│ │ Thành viên: 12                                       │ │
│ │ Ảnh featured: 24                                     │ │
│ │ Truyền thống: 5                                      │ │
│ │ Lời dặn: 9                                           │ │
│ │ Ước tính: ~38 trang, ~3 MB                          │ │
│ └──────────────────────────────────────────────────────┘ │
│                                                           │
│ [📕 Tải PDF] [🔍 Xem trước (≈ 5s)]                       │
└──────────────────────────────────────────────────────────┘
```

Buttons:
- **Tải PDF** → triggers `<a href="/admin/heritage-book.pdf?...">` download
- **Xem trước** → opens iframe modal preview (lazy)

---

## 7. Endpoint flow

`GET /admin/heritage-book.pdf?include_drafts=&include_photos=&...&lang=vi`

```ts
export const prerender = false;

export const GET: APIRoute = async ({ url, locals }) => {
  const me = locals.user;
  if (!me || (me.role !== "admin" && me.role !== "branch_editor")) {
    return new Response("Forbidden", { status: 403 });
  }

  await ensureFonts();
  const opts = parseOptions(url.searchParams);
  const data = await buildBookData(opts);

  const pdfStream = await renderToStream(<HeritageBook data={data} />);

  return new Response(pdfStream as unknown as ReadableStream, {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="gia-pha-ho-${data.surname}-${data.publicationYear}.pdf"`,
      "cache-control": "no-store",
    },
  });
};
```

Stream piped → minimal memory.

---

## 8. Phasing

| Phase | Scope | Files | Effort |
|---|---|---|---|
| **HB1** Foundation | install deps, fonts, styles, data loader, root Document, smoke render | `package.json`, `lib/heritage-book/{fonts,styles,data,index}.tsx` | 0.3d |
| **HB2** Cover + intro | Cover, Foreword, TableOfContents, BackCover | `pages/{Cover,Foreword,TableOfContents,BackCover}.tsx` + `motifs/LotusSeal.tsx` | 0.4d |
| **HB3** Member spreads | 2-page spread per member (portrait + bio + drop cap + lời dặn pull-quote) | `pages/MemberSpread.tsx` + `motifs/BlossomDivider.tsx` | 0.5d |
| **HB4** Album + traditions + quotes | Mosaic gallery + tradition pages + quotes | `pages/{PhotoMosaic,TraditionPage,QuotesPage}.tsx` | 0.4d |
| **HB5** Lineage + calendar | SVG lineage chart + calendar of giỗ | `pages/{LineageChart,CalendarPage}.tsx` | 0.3d |
| **HB6** Admin UI + endpoint | `/admin/heritage-book` page + GET PDF route | `pages/admin/heritage-book.astro`, `pages/admin/heritage-book.pdf.ts`, sidebar nav entry | 0.3d |
| **HB7** Polish + smoke + push | QA real data, edge cases, build verify, memory update, push | — | 0.3d |

Total **~2.5 dev-days, 12-14 tasks**.

---

## 9. Risks + mitigations

| Risk | L | I | Mitigation |
|---|---|---|---|
| react-pdf font registration fails (network) | M | H | Cache TTF binaries to disk on first run; fallback to system font |
| Photos URLs unreachable | M | M | Try/catch per image; render placeholder rectangle |
| PDF size blows up with 100 photos | M | M | Cap album to 32 photos in mosaic; reduce sepia processing |
| Long bio text breaks layout | M | M | Truncate at ~700 words/spread; "..." + "tiếp trang sau" if needed |
| Vietnamese diacritic rendering glitch | L | H | Verified subset works in OG image (proven); test with real names |
| Concurrent PDF generation OOM | L | M | Single-stream render; rate-limit endpoint to 1 concurrent per user |
| Markdown body has HTML strings | M | L | Strip HTML tags via regex before passing to <Text> primitive |

---

## 10. Acceptance criteria

- [ ] PDF generates < 5s for 30-page book
- [ ] File size < 8 MB target
- [ ] All Vietnamese diacritics render correctly (no missing glyphs)
- [ ] Sepia portraits look warm, not gothic
- [ ] Drop cap renders gold-2 first letter
- [ ] Pull-quote sections have gold-2 left border
- [ ] No CJK chars in source (CI guard)
- [ ] Admin can toggle drafts / photos / traditions / album
- [ ] Download button triggers immediate browser download
- [ ] PDF tagged for screen readers (default react-pdf)
- [ ] Sidebar nav has "📕 Heritage Book" entry under TƯỞNG NIỆM group

---

## 11. Out of scope (defer)

- Fold-out A3 lineage chart (tree spread across landscape)
- Văn khấn library page
- URL snapshot for public Zalo share
- Multi-volume support
- Print profile customization (CMYK conversion, bleed marks)
- Editable PDF / form fields
- Cover photo customization (admin upload custom background)
- EN translation full pass (i18n-ready but content stays VN for v1)
- Save snapshot to Supabase Storage
- "Print preview" Astro modal vs direct iframe

---

## 12. References

- `DESIGN-MEMORIAL.md` — memorial layer (sepia portrait pattern, drop cap pattern)
- `DESIGN-NOTIFICATIONS.md` — multi-channel pipeline (i18n catalog reuse)
- `src/lib/og-memorial.tsx` — Satori OG image (similar JSX→image pattern)
- `src/lib/og-fonts.ts` — Vietnamese font URLs (reuse list)
- Memory: `feedback_family_memorial_tone.md`
- Memory: `feedback_family_no_chinese_chars.md`
- Memory: `feedback_family_naming_convention.md`
- Memory: `feedback_family_i18n_ready.md`
- Memory: `feedback_prefer_proven_libs.md`
