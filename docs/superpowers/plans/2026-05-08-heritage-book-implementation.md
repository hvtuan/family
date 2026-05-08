# Heritage Book PDF Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `/admin/heritage-book` admin page that generates a 30-50 page A4 PDF (gia phả in được) leveraging 100% existing data — members, photos, quotes, traditions, dates, settings — via `@react-pdf/renderer` with Vietnamese-subset fonts.

**Architecture:** Reuse existing data loaders + lib motifs + Vietnamese font URLs. PDF rendered server-side as a stream piped to download response. No DB writes, no caching — admin generates on demand.

**Tech Stack:** Astro 6 SSR + React + `@react-pdf/renderer` (~15k stars) · existing `getMembers`/`getQuotes`/`getTraditions`/`getPhotos`/`getDates` · `formatLunarVi` from memorial lib · Lora + Be Vietnam Pro + Dancing Script (Vietnamese subset)

**Spec source:** `DESIGN-HERITAGE-BOOK.md`

---

## Phase HB1 — Foundation

### Task 1: Install @react-pdf/renderer + scaffold lib structure

**Files:**
- Modify: `package.json`, `pnpm-lock.yaml`
- Create: `src/lib/heritage-book/fonts.ts`
- Create: `src/lib/heritage-book/styles.ts`
- Create: `src/lib/heritage-book/data.ts`
- Create: `src/lib/heritage-book/index.tsx`

- [ ] **Step 1: Install dep**

```bash
cd /home/mininja/Github/family
pnpm add @react-pdf/renderer
```

Expected: `+ @react-pdf/renderer <ver>` (typically 4.x).

- [ ] **Step 2: Create `src/lib/heritage-book/fonts.ts`**

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

- [ ] **Step 3: Create `src/lib/heritage-book/styles.ts`**

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

- [ ] **Step 4: Create `src/lib/heritage-book/data.ts`**

```ts
import {
  getMembers, getQuotes, getTraditions, getPhotos,
  type MemberEntry, type QuoteEntry, type TraditionEntry, type PhotoData,
} from "@/lib/content";
import { toClientMember, type ClientMember } from "@/lib/members-client";
import { getDeceasedMembers, type MemorialMember } from "@/lib/memorial";
import { getSiteIdentity } from "@/lib/settings";

export interface BuildBookOptions {
  includeDrafts: boolean;
  includePhotos: boolean;
  includeTraditions: boolean;
  includeAlbum: boolean;
  lang: "vi" | "en";
}

export interface BookData {
  surname: string;
  brand: { vi: string; en: string };
  hometown: string;
  motto: string;
  established: number;
  publicationYear: number;
  lang: "vi" | "en";
  members: ClientMember[];
  deceasedMembers: MemorialMember[];
  quotes: QuoteEntry[];
  traditions: TraditionEntry[];
  photos: PhotoData[];
}

export async function buildBookData(opts: BuildBookOptions): Promise<BookData> {
  const site = await getSiteIdentity();

  const allMemberEntries = await getMembers();
  const memberEntries = opts.includeDrafts
    ? allMemberEntries
    : allMemberEntries.filter((m) => m.data.status === "published");

  const members = memberEntries
    .map(toClientMember)
    .sort((a, b) => a.gen - b.gen || (a.birthOrder ?? 99) - (b.birthOrder ?? 99));

  const deceasedMembers = await getDeceasedMembers();

  const quotes = await getQuotes();
  const traditions = opts.includeTraditions ? await getTraditions() : [];

  let photos: PhotoData[] = [];
  if (opts.includeAlbum || opts.includePhotos) {
    const allPhotos = await getPhotos();
    photos = allPhotos
      .map((p) => p.data)
      .sort((a, b) => {
        if (a.featured !== b.featured) return a.featured ? -1 : 1;
        return (b.year ?? 0) - (a.year ?? 0);
      })
      .slice(0, 32);
  }

  return {
    surname: site.surname || "Nguyễn",
    brand: { vi: site.brandVi || "Gia đình", en: site.brandEn || "Family" },
    hometown: site.hometown || "",
    motto: site.motto || "",
    established: site.established || 1900,
    publicationYear: new Date().getFullYear(),
    lang: opts.lang,
    members,
    deceasedMembers,
    quotes,
    traditions,
    photos,
  };
}
```

- [ ] **Step 5: Create root `src/lib/heritage-book/index.tsx`**

```tsx
import { Document, Page, Text } from "@react-pdf/renderer";
import { styles } from "./styles";
import type { BookData } from "./data";

interface Props {
  data: BookData;
}

export function HeritageBook({ data }: Props) {
  return (
    <Document
      title={`Gia phả họ ${data.surname} ${data.publicationYear}`}
      author={data.brand.vi}
      subject="Gia phả - genealogy book"
      keywords="gia pha, family genealogy"
    >
      {/* Placeholder smoke page — Phase HB2+ replaces with real Cover/Foreword/etc. */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.kicker}>Gia Phả</Text>
        <Text style={styles.display}>Họ {data.surname}</Text>
        <Text style={styles.bodySerif}>
          Phiên bản {data.publicationYear} · {data.members.length} thành viên ·{" "}
          {data.deceasedMembers.length} đã khuất
        </Text>
      </Page>
    </Document>
  );
}
```

- [ ] **Step 6: Verify build**

```bash
pnpm check 2>&1 | grep -E 'error ts|Result' | tail -3
pnpm check:no-cjk
pnpm build
```

Expect 0 errors. The lib isn't wired anywhere yet, just compiles.

- [ ] **Step 7: Commit**

```bash
git add package.json pnpm-lock.yaml src/lib/heritage-book
git commit -m "feat(heritage HB1): scaffold @react-pdf/renderer lib (fonts + styles + data + smoke Document)"
```

DO NOT push.

---

## Phase HB2 — Cover + intro pages

### Task 2: Cover + BackCover + LotusSeal motif

**Files:**
- Create: `src/lib/heritage-book/motifs/LotusSeal.tsx`
- Create: `src/lib/heritage-book/pages/Cover.tsx`
- Create: `src/lib/heritage-book/pages/BackCover.tsx`

- [ ] **Step 1: LotusSeal motif (PDF-friendly SVG primitive)**

```tsx
import { Svg, Path, G, Text, View } from "@react-pdf/renderer";
import { COLORS } from "../styles";

interface Props { size?: number; surname?: string; }

export function LotusSeal({ size = 80, surname }: Props) {
  return (
    <View style={{ alignItems: "center" }}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <G fill={COLORS.gold2} opacity={0.85}>
          <Path d="M50 20 C 40 30, 35 45, 35 55 C 35 60, 38 65, 50 65 C 62 65, 65 60, 65 55 C 65 45, 60 30, 50 20 Z" />
          <Path d="M30 35 C 25 45, 25 55, 30 60 C 35 62, 40 60, 42 55 C 38 48, 32 40, 30 35 Z" />
          <Path d="M70 35 C 75 45, 75 55, 70 60 C 65 62, 60 60, 58 55 C 62 48, 68 40, 70 35 Z" />
          <Path d="M50 60 L 50 80" stroke={COLORS.gold2} strokeWidth={2} />
        </G>
      </Svg>
      {surname && (
        <Text style={{ fontFamily: "DancingScript", fontSize: size * 0.28, color: COLORS.gold2, marginTop: 6 }}>
          Họ {surname}
        </Text>
      )}
    </View>
  );
}
```

- [ ] **Step 2: Cover**

```tsx
import { Page, Text, View } from "@react-pdf/renderer";
import { styles, COLORS } from "../styles";
import { LotusSeal } from "../motifs/LotusSeal";
import type { BookData } from "../data";

interface Props { data: BookData; }

export function Cover({ data }: Props) {
  return (
    <Page size="A4" style={[styles.page, { padding: 0, backgroundColor: COLORS.cream }]}>
      <View style={{
        flex: 1, justifyContent: "space-between", alignItems: "center",
        padding: 56, borderWidth: 1.5, borderColor: COLORS.gold2, margin: 20,
      }}>
        <View style={{ alignItems: "center", marginTop: 40 }}>
          <Text style={{ fontFamily: "BeVietnamPro", fontSize: 11, color: COLORS.gold2, letterSpacing: 4, textTransform: "uppercase" }}>
            Gia Phả · Genealogy
          </Text>
        </View>
        <View style={{ alignItems: "center", gap: 18 }}>
          <LotusSeal size={140} />
          <Text style={{ fontFamily: "DancingScript", fontSize: 78, color: COLORS.gold2, lineHeight: 0.95 }}>
            Họ {data.surname}
          </Text>
          <Text style={{ fontFamily: "Lora", fontStyle: "italic", fontSize: 14, color: COLORS.ink2, textAlign: "center", maxWidth: 320 }}>
            "{data.motto}"
          </Text>
        </View>
        <View style={{ alignItems: "center", gap: 6 }}>
          <Text style={{ fontFamily: "BeVietnamPro", fontSize: 10, color: COLORS.ink3, letterSpacing: 1 }}>
            {data.hometown}
          </Text>
          <Text style={{ fontFamily: "BeVietnamPro", fontSize: 10, color: COLORS.ink3, fontWeight: 600 }}>
            {data.established} — {data.publicationYear}
          </Text>
        </View>
      </View>
    </Page>
  );
}
```

- [ ] **Step 3: BackCover**

```tsx
import { Page, Text, View } from "@react-pdf/renderer";
import { styles, COLORS } from "../styles";
import { LotusSeal } from "../motifs/LotusSeal";
import type { BookData } from "../data";

interface Props { data: BookData; }

export function BackCover({ data }: Props) {
  return (
    <Page size="A4" style={[styles.page, { padding: 0, backgroundColor: COLORS.cream }]}>
      <View style={{
        flex: 1, justifyContent: "center", alignItems: "center",
        padding: 56, gap: 28,
      }}>
        <LotusSeal size={120} surname={data.surname} />
        <View style={{ alignItems: "center", gap: 4 }}>
          <Text style={{ fontFamily: "Lora", fontStyle: "italic", fontSize: 12, color: COLORS.ink3 }}>
            Cập nhật trực tuyến tại
          </Text>
          <Text style={{ fontFamily: "BeVietnamPro", fontSize: 11, color: COLORS.gold2, letterSpacing: 1.2 }}>
            family.huynhvantuan.net
          </Text>
        </View>
        <Text style={{ position: "absolute", bottom: 48, fontSize: 9, color: COLORS.ink3, letterSpacing: 1 }}>
          Phát hành {data.publicationYear}
        </Text>
      </View>
    </Page>
  );
}
```

- [ ] **Step 4: Wire Cover + BackCover into HeritageBook**

Modify `src/lib/heritage-book/index.tsx`:

```tsx
import { Document } from "@react-pdf/renderer";
import { Cover } from "./pages/Cover";
import { BackCover } from "./pages/BackCover";
import type { BookData } from "./data";

interface Props { data: BookData; }

export function HeritageBook({ data }: Props) {
  return (
    <Document title={`Gia phả họ ${data.surname} ${data.publicationYear}`} author={data.brand.vi}>
      <Cover data={data} />
      <BackCover data={data} />
    </Document>
  );
}
```

- [ ] **Step 5: Verify build**

```bash
pnpm check && pnpm check:no-cjk && pnpm build
```

Expected: 0 errors.

- [ ] **Step 6: Commit**

```bash
git add src/lib/heritage-book/motifs src/lib/heritage-book/pages src/lib/heritage-book/index.tsx
git commit -m "feat(heritage HB2.1): Cover + BackCover + LotusSeal motif"
```

---

### Task 3: Foreword + TableOfContents

**Files:**
- Create: `src/lib/heritage-book/pages/Foreword.tsx`
- Create: `src/lib/heritage-book/pages/TableOfContents.tsx`
- Create: `src/lib/heritage-book/motifs/BlossomDivider.tsx`

- [ ] **Step 1: BlossomDivider motif**

```tsx
import { Svg, Path, Text, View } from "@react-pdf/renderer";
import { COLORS } from "../styles";

export function BlossomDivider() {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginVertical: 14, justifyContent: "center" }}>
      <View style={{ height: 1, width: 60, backgroundColor: COLORS.gold2, opacity: 0.5 }} />
      <Svg width={14} height={14} viewBox="0 0 24 24">
        <Path
          d="M12 2 C 14 6, 18 8, 22 12 C 18 16, 14 18, 12 22 C 10 18, 6 16, 2 12 C 6 8, 10 6, 12 2 Z"
          fill={COLORS.gold2}
          opacity={0.7}
        />
      </Svg>
      <View style={{ height: 1, width: 60, backgroundColor: COLORS.gold2, opacity: 0.5 }} />
    </View>
  );
}
```

- [ ] **Step 2: Foreword**

```tsx
import { Page, Text, View } from "@react-pdf/renderer";
import { styles, COLORS } from "../styles";
import { BlossomDivider } from "../motifs/BlossomDivider";
import type { BookData } from "../data";

interface Props { data: BookData; }

export function Foreword({ data }: Props) {
  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.kicker}>Lời nói đầu</Text>
      <Text style={styles.display}>{data.brand.vi}</Text>

      <View style={{ marginTop: 28, marginBottom: 14 }}>
        <Text style={{ ...styles.bodySerif, fontStyle: "italic", fontSize: 16, color: COLORS.ink2, textAlign: "center" }}>
          "{data.motto}"
        </Text>
      </View>

      <BlossomDivider />

      <View style={{ marginTop: 18, gap: 12 }}>
        <Text style={styles.bodySerif}>
          Cuốn sách này tổng hợp thông tin về {data.members.length} thành viên dòng họ, từ {data.established}{" "}
          đến nay. Quê hương: {data.hometown}.
        </Text>
        <Text style={styles.bodySerif}>
          Mọi thông tin được giữ và cập nhật online tại family.huynhvantuan.net. Phiên bản giấy này
          được phát hành nhằm lưu giữ và chia sẻ trong gia đình — đặt trên bàn thờ, mang đi đám giỗ,
          làm quà cho con cháu xa quê.
        </Text>
        <Text style={styles.bodySerif}>
          Nguồn ảnh, ngày tháng, ngày giỗ, lời dặn — tất cả do gia đình tự thu thập. Có thể có sai sót,
          xin các cô chú bổ sung qua admin website.
        </Text>
      </View>

      <Text style={styles.pageNumber} render={({ pageNumber }) => `${pageNumber}`} fixed />
    </Page>
  );
}
```

- [ ] **Step 3: TableOfContents**

```tsx
import { Page, Text, View } from "@react-pdf/renderer";
import { styles, COLORS } from "../styles";
import type { BookData } from "../data";

interface Props { data: BookData; }

interface TocEntry { label: string; page: number; }

export function TableOfContents({ data }: Props) {
  // Approximate page numbers. Final could compute via two-pass render but
  // for v1 we estimate based on counts.
  const entries: TocEntry[] = [
    { label: "Lời nói đầu", page: 3 },
    { label: "Mục lục", page: 5 },
    { label: "Sơ đồ phả hệ", page: 6 },
    { label: "Tiểu sử thành viên", page: 7 },
    { label: "Album ảnh", page: 7 + data.members.length * 2 },
    { label: "Truyền thống", page: 9 + data.members.length * 2 + Math.ceil(data.photos.length / 6) },
    { label: "Lời dặn", page: 10 + data.members.length * 2 + Math.ceil(data.photos.length / 6) + data.traditions.length },
    { label: "Lịch giỗ", page: 12 + data.members.length * 2 + Math.ceil(data.photos.length / 6) + data.traditions.length + Math.ceil(data.quotes.length / 4) },
  ];

  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.kicker}>Mục lục</Text>
      <Text style={[styles.display, { fontSize: 24, marginBottom: 24 }]}>Mục lục</Text>

      <View style={{ gap: 10 }}>
        {entries.map((e) => (
          <View key={e.label} style={{ flexDirection: "row", alignItems: "baseline" }}>
            <Text style={{ ...styles.bodySerif, fontSize: 12, color: COLORS.ink }}>{e.label}</Text>
            <View style={{ flex: 1, marginHorizontal: 8, borderBottomWidth: 0.5, borderBottomColor: COLORS.border, borderStyle: "dotted", marginBottom: 3 }} />
            <Text style={{ fontFamily: "BeVietnamPro", fontSize: 11, color: COLORS.ink2 }}>{e.page}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.pageNumber} render={({ pageNumber }) => `${pageNumber}`} fixed />
    </Page>
  );
}
```

- [ ] **Step 4: Wire into HeritageBook**

Modify `src/lib/heritage-book/index.tsx`:

```tsx
import { Document } from "@react-pdf/renderer";
import { Cover } from "./pages/Cover";
import { Foreword } from "./pages/Foreword";
import { TableOfContents } from "./pages/TableOfContents";
import { BackCover } from "./pages/BackCover";
import type { BookData } from "./data";

interface Props { data: BookData; }

export function HeritageBook({ data }: Props) {
  return (
    <Document title={`Gia phả họ ${data.surname} ${data.publicationYear}`} author={data.brand.vi}>
      <Cover data={data} />
      <Foreword data={data} />
      <TableOfContents data={data} />
      <BackCover data={data} />
    </Document>
  );
}
```

- [ ] **Step 5: Verify + commit**

```bash
pnpm check && pnpm check:no-cjk && pnpm build
git add src/lib/heritage-book/pages src/lib/heritage-book/motifs src/lib/heritage-book/index.tsx
git commit -m "feat(heritage HB2.2): Foreword + TableOfContents + BlossomDivider"
```

---

## Phase HB3 — Member spreads

### Task 4: MemberSpread component (2 pages per member)

**Files:**
- Create: `src/lib/heritage-book/pages/MemberSpread.tsx`

- [ ] **Step 1: Implement MemberSpread**

```tsx
import { Page, Text, View, Image } from "@react-pdf/renderer";
import { styles, COLORS } from "../styles";
import { BlossomDivider } from "../motifs/BlossomDivider";
import { formatLunarVi, solarToLunar } from "@/lib/lunar";
import type { ClientMember } from "@/lib/members-client";
import type { QuoteEntry } from "@/lib/content";

interface Props {
  member: ClientMember;
  quotes: QuoteEntry[];
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

function safeText(s: string): string {
  // Strip HTML tags from rendered markdown so PDF Text doesn't break
  return s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

export function MemberSpread({ member, quotes }: Props) {
  const memberQuotes = quotes.filter((q) => q.data.authorRef?.id === member.id);
  const lunarBorn = member.born ? formatLunarVi(solarToLunar(new Date(member.born))) : null;
  const lunarDied = member.died ? formatLunarVi(solarToLunar(new Date(member.died))) : null;

  const bioText = safeText(member.bio || "");
  const truncatedBio = bioText.length > 700 ? bioText.slice(0, 700) + "..." : bioText;

  return (
    <>
      {/* Left page: portrait + identity */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.kicker}>Đời thứ {member.gen}</Text>

        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 18 }}>
          {member.photo ? (
            <View style={{ width: 240, height: 300, borderWidth: 1, borderColor: COLORS.gold2, opacity: 0.95 }}>
              <Image src={member.photo} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            </View>
          ) : (
            <View style={{ width: 240, height: 300, borderWidth: 1, borderColor: COLORS.gold2, alignItems: "center", justifyContent: "center", backgroundColor: COLORS.cream }}>
              <Text style={{ fontFamily: "Lora", fontSize: 80, color: COLORS.gold2, opacity: 0.4 }}>
                {member.name.slice(0, 1)}
              </Text>
            </View>
          )}

          <View style={{ alignItems: "center", gap: 4 }}>
            <Text style={{ fontFamily: "Lora", fontStyle: "italic", fontSize: 26, color: COLORS.ink, textAlign: "center" }}>
              {member.name}
            </Text>
            {member.role && (
              <Text style={{ fontSize: 10, color: COLORS.ink2, letterSpacing: 1 }}>
                {member.role}{member.isFamilyHead ? " · Tộc trưởng" : ""}
              </Text>
            )}
          </View>

          <View style={{ alignItems: "center", gap: 4, marginTop: 10 }}>
            <Text style={{ fontSize: 10, color: COLORS.ink2 }}>
              Sinh: {formatDate(member.born)}
            </Text>
            {lunarBorn && <Text style={{ fontSize: 9, color: COLORS.ink3, fontStyle: "italic" }}>{lunarBorn}</Text>}
            {member.died && (
              <>
                <Text style={{ fontSize: 10, color: COLORS.ink2, marginTop: 4 }}>
                  Mất: {formatDate(member.died)}
                </Text>
                {lunarDied && <Text style={{ fontSize: 9, color: COLORS.ink3, fontStyle: "italic" }}>{lunarDied}</Text>}
              </>
            )}
          </View>
        </View>

        <Text style={styles.pageNumber} render={({ pageNumber }) => `${pageNumber}`} fixed />
      </Page>

      {/* Right page: bio + lời dặn */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.kicker}>Tiểu sử</Text>
        <Text style={[styles.display, { fontSize: 22, marginBottom: 14 }]}>{member.name}</Text>

        {truncatedBio && (
          <Text style={[styles.bodySerif, { textAlign: "justify" }]}>
            {truncatedBio}
          </Text>
        )}

        {memberQuotes.length > 0 && (
          <>
            <BlossomDivider />
            <Text style={[styles.kicker, { marginTop: 0 }]}>Lời dặn</Text>
            {memberQuotes.slice(0, 2).map((q) => (
              <View key={q.id} style={[styles.blockquote, { marginVertical: 8 }]}>
                <Text style={[styles.bodySerif, { fontStyle: "italic", fontSize: 11 }]}>
                  "{q.data.text}"
                </Text>
              </View>
            ))}
          </>
        )}

        <Text style={styles.pageNumber} render={({ pageNumber }) => `${pageNumber}`} fixed />
      </Page>
    </>
  );
}
```

- [ ] **Step 2: Wire into HeritageBook**

```tsx
import { MemberSpread } from "./pages/MemberSpread";

// inside <Document>:
{data.members.map((m) => (
  <MemberSpread key={m.id} member={m} quotes={data.quotes} />
))}
```

- [ ] **Step 3: Verify + commit**

```bash
pnpm check && pnpm check:no-cjk && pnpm build
git add src/lib/heritage-book/pages/MemberSpread.tsx src/lib/heritage-book/index.tsx
git commit -m "feat(heritage HB3): MemberSpread — 2 pages per member with sepia portrait + bio + lời dặn"
```

---

## Phase HB4 — Album + traditions + quotes

### Task 5: PhotoMosaic page

**Files:**
- Create: `src/lib/heritage-book/pages/PhotoMosaic.tsx`

- [ ] **Step 1: Implement**

```tsx
import { Page, Text, View, Image } from "@react-pdf/renderer";
import { styles, COLORS } from "../styles";
import type { PhotoData } from "@/lib/content";

interface Props { photos: PhotoData[]; }

export function PhotoMosaic({ photos }: Props) {
  // Group 6 per page
  const pages: PhotoData[][] = [];
  for (let i = 0; i < photos.length; i += 6) {
    pages.push(photos.slice(i, i + 6));
  }

  return (
    <>
      {pages.map((batch, idx) => (
        <Page key={idx} size="A4" style={styles.page}>
          <Text style={styles.kicker}>Album · Trang {idx + 1}/{pages.length}</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
            {batch.map((p, i) => (
              <View key={i} style={{ width: "32%", marginBottom: 12 }}>
                <Image src={p.src} style={{ width: "100%", height: 130, objectFit: "cover", opacity: 0.95 }} />
                <Text style={{ fontFamily: "Lora", fontStyle: "italic", fontSize: 8, color: COLORS.ink3, marginTop: 4 }} numberOfLines={2}>
                  {p.caption || "—"}
                  {p.year ? ` · ${p.year}` : ""}
                </Text>
              </View>
            ))}
          </View>
          <Text style={styles.pageNumber} render={({ pageNumber }) => `${pageNumber}`} fixed />
        </Page>
      ))}
    </>
  );
}
```

- [ ] **Step 2: Wire + verify + commit**

```tsx
{data.photos.length > 0 && <PhotoMosaic photos={data.photos} />}
```

```bash
pnpm check && pnpm build
git add src/lib/heritage-book/pages/PhotoMosaic.tsx src/lib/heritage-book/index.tsx
git commit -m "feat(heritage HB4.1): PhotoMosaic — 3-col gallery, 6 photos/page"
```

---

### Task 6: TraditionPage

**Files:**
- Create: `src/lib/heritage-book/pages/TraditionPage.tsx`

- [ ] **Step 1: Implement**

```tsx
import { Page, Text, View, Image } from "@react-pdf/renderer";
import { styles, COLORS } from "../styles";
import { BlossomDivider } from "../motifs/BlossomDivider";
import type { TraditionEntry } from "@/lib/content";

interface Props { tradition: TraditionEntry; }

function safeText(s: string): string {
  return s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

export function TraditionPage({ tradition }: Props) {
  const data = tradition.data;
  const body = safeText(tradition.body || data.desc || "");
  const truncated = body.length > 1100 ? body.slice(0, 1100) + "..." : body;

  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.kicker}>Truyền thống · {data.category}</Text>
      <Text style={[styles.display, { fontSize: 22, marginBottom: 14 }]}>{data.name}</Text>

      {data.image && (
        <View style={{ height: 180, marginBottom: 14 }}>
          <Image src={data.image} style={{ width: "100%", height: "100%", objectFit: "cover", opacity: 0.95 }} />
        </View>
      )}

      <Text style={[styles.bodySerif, { textAlign: "justify" }]}>{truncated}</Text>

      {data.tags && data.tags.length > 0 && (
        <>
          <BlossomDivider />
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
            {data.tags.slice(0, 8).map((t) => (
              <Text key={t} style={{ fontSize: 8, color: COLORS.ink3, borderWidth: 0.5, borderColor: COLORS.border, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                {t}
              </Text>
            ))}
          </View>
        </>
      )}

      <Text style={styles.pageNumber} render={({ pageNumber }) => `${pageNumber}`} fixed />
    </Page>
  );
}
```

- [ ] **Step 2: Wire + verify + commit**

```tsx
{data.traditions.map((t) => <TraditionPage key={t.id} tradition={t} />)}
```

```bash
pnpm check && pnpm build
git add src/lib/heritage-book/pages/TraditionPage.tsx src/lib/heritage-book/index.tsx
git commit -m "feat(heritage HB4.2): TraditionPage — image + body + tag chips"
```

---

### Task 7: QuotesPage

**Files:**
- Create: `src/lib/heritage-book/pages/QuotesPage.tsx`

- [ ] **Step 1: Implement**

```tsx
import { Page, Text, View } from "@react-pdf/renderer";
import { styles, COLORS } from "../styles";
import type { QuoteEntry } from "@/lib/content";
import type { ClientMember } from "@/lib/members-client";

interface Props {
  quotes: QuoteEntry[];
  members: ClientMember[];
}

export function QuotesPage({ quotes, members }: Props) {
  const memberById = new Map(members.map((m) => [m.id, m]));

  const pages: QuoteEntry[][] = [];
  for (let i = 0; i < quotes.length; i += 4) {
    pages.push(quotes.slice(i, i + 4));
  }

  return (
    <>
      {pages.map((batch, idx) => (
        <Page key={idx} size="A4" style={styles.page}>
          <Text style={styles.kicker}>Lời dặn · {idx + 1}/{pages.length}</Text>

          <View style={{ flex: 1, justifyContent: "space-around", gap: 18, marginTop: 10 }}>
            {batch.map((q) => {
              const author = q.data.authorRef ? memberById.get(q.data.authorRef.id) : null;
              return (
                <View key={q.id} style={{ position: "relative", paddingLeft: 24 }}>
                  <Text style={{ position: "absolute", left: 0, top: -10, fontFamily: "Lora", fontSize: 32, color: COLORS.vermilion, opacity: 0.4 }}>
                    "
                  </Text>
                  <Text style={{ fontFamily: "Lora", fontStyle: "italic", fontSize: 13, color: COLORS.ink, lineHeight: 1.55 }}>
                    {q.data.text}
                  </Text>
                  <Text style={{ fontFamily: "BeVietnamPro", fontSize: 9, color: COLORS.ink2, marginTop: 6, fontWeight: 600 }}>
                    — {q.data.author}{author ? ` · Đời ${author.gen}` : ""}
                  </Text>
                </View>
              );
            })}
          </View>

          <Text style={styles.pageNumber} render={({ pageNumber }) => `${pageNumber}`} fixed />
        </Page>
      ))}
    </>
  );
}
```

- [ ] **Step 2: Wire + verify + commit**

```tsx
{data.quotes.length > 0 && <QuotesPage quotes={data.quotes} members={data.members} />}
```

```bash
pnpm check && pnpm build
git add src/lib/heritage-book/pages/QuotesPage.tsx src/lib/heritage-book/index.tsx
git commit -m "feat(heritage HB4.3): QuotesPage — 4 quotes/page with vermilion drop quote mark"
```

---

## Phase HB5 — Lineage + calendar

### Task 8: LineageChart (compact A4 SVG tree)

**Files:**
- Create: `src/lib/heritage-book/pages/LineageChart.tsx`

- [ ] **Step 1: Implement**

```tsx
import { Page, Text, View, Svg, Line, Rect, Text as SvgText } from "@react-pdf/renderer";
import { styles, COLORS } from "../styles";
import type { ClientMember } from "@/lib/members-client";

interface Props { members: ClientMember[]; }

export function LineageChart({ members }: Props) {
  // Group by gen
  const byGen = new Map<number, ClientMember[]>();
  for (const m of members) {
    if (!byGen.has(m.gen)) byGen.set(m.gen, []);
    byGen.get(m.gen)!.push(m);
  }
  const generations = Array.from(byGen.keys()).sort((a, b) => a - b);

  const PAGE_W = 595; // A4 width pt
  const CHART_W = PAGE_W - 96;
  const CHART_H = 700;
  const ROW_H = CHART_H / Math.max(generations.length, 1);

  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.kicker}>Sơ đồ phả hệ</Text>
      <Text style={[styles.display, { fontSize: 22, marginBottom: 14 }]}>Cây gia phả</Text>

      <Svg width={CHART_W} height={CHART_H} viewBox={`0 0 ${CHART_W} ${CHART_H}`}>
        {generations.map((gen, rowIdx) => {
          const rowMembers = byGen.get(gen)!;
          const colWidth = CHART_W / Math.max(rowMembers.length, 1);
          const y = rowIdx * ROW_H + ROW_H / 2;
          return rowMembers.map((m, colIdx) => {
            const x = colIdx * colWidth + colWidth / 2;
            return (
              <React.Fragment key={m.id}>
                <Rect x={x - 50} y={y - 16} width={100} height={32} stroke={COLORS.gold2} strokeWidth={0.7} fill="transparent" />
                <SvgText x={x} y={y - 2} textAnchor="middle" style={{ fontSize: 8, fill: COLORS.ink, fontFamily: "Lora", fontStyle: "italic" }}>
                  {m.name.length > 16 ? m.name.slice(0, 14) + "…" : m.name}
                </SvgText>
                <SvgText x={x} y={y + 10} textAnchor="middle" style={{ fontSize: 6, fill: COLORS.ink3, fontFamily: "BeVietnamPro" }}>
                  Đời {m.gen}
                </SvgText>
              </React.Fragment>
            );
          });
        })}
      </Svg>

      <Text style={[styles.bodySerif, { fontSize: 9, color: COLORS.ink3, marginTop: 14, textAlign: "center" }]}>
        Sơ đồ tóm tắt — chi tiết tiểu sử xem các trang sau
      </Text>

      <Text style={styles.pageNumber} render={({ pageNumber }) => `${pageNumber}`} fixed />
    </Page>
  );
}
```

NOTE: react-pdf's Svg children don't support React Fragment directly — use plain arrays:

Replace the inner map's `<React.Fragment>` with returning an array `[<Rect ... />, <SvgText ... />, <SvgText ... />]` directly. Add `import React from "react";` at top.

Actually simpler: wrap in `<G>` group element from `@react-pdf/renderer`:

```tsx
import { G } from "@react-pdf/renderer";
```

Use `<G key={m.id}>...</G>`.

- [ ] **Step 2: Wire + commit**

```tsx
<LineageChart members={data.members} />
```

```bash
pnpm check && pnpm build
git add src/lib/heritage-book/pages/LineageChart.tsx src/lib/heritage-book/index.tsx
git commit -m "feat(heritage HB5.1): LineageChart — compact SVG tree on A4"
```

---

### Task 9: CalendarPage (lịch giỗ)

**Files:**
- Create: `src/lib/heritage-book/pages/CalendarPage.tsx`

- [ ] **Step 1: Implement**

```tsx
import { Page, Text, View } from "@react-pdf/renderer";
import { styles, COLORS } from "../styles";
import { formatLunarVi, solarToLunar } from "@/lib/lunar";
import type { MemorialMember } from "@/lib/memorial";

interface Props { deceased: MemorialMember[]; }

export function CalendarPage({ deceased }: Props) {
  const sorted = deceased
    .filter((m) => m.died)
    .map((m) => {
      const d = new Date(m.died!);
      return {
        member: m,
        month: d.getMonth() + 1,
        day: d.getDate(),
        year: d.getFullYear(),
        lunar: formatLunarVi(solarToLunar(d)),
      };
    })
    .sort((a, b) => a.month - b.month || a.day - b.day);

  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.kicker}>Lịch giỗ</Text>
      <Text style={[styles.display, { fontSize: 22, marginBottom: 4 }]}>Lịch giỗ trong năm</Text>
      <Text style={[styles.bodySerif, { fontSize: 10, color: COLORS.ink3, marginBottom: 18 }]}>
        Ngày giỗ tổ tiên đã khuất, sắp theo tháng dương lịch
      </Text>

      <View style={{ gap: 10 }}>
        {sorted.map(({ member, month, day, year, lunar }) => (
          <View key={member.id} style={{ flexDirection: "row", alignItems: "center", gap: 14, paddingBottom: 8, borderBottomWidth: 0.5, borderBottomColor: COLORS.border }}>
            <View style={{ width: 56, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: COLORS.gold2, padding: 6, borderRadius: 4 }}>
              <Text style={{ fontFamily: "BeVietnamPro", fontSize: 18, fontWeight: 600, color: COLORS.ink }}>
                {String(day).padStart(2, "0")}
              </Text>
              <Text style={{ fontFamily: "BeVietnamPro", fontSize: 7, color: COLORS.ink3, letterSpacing: 0.5 }}>
                THÁNG {month}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontFamily: "Lora", fontStyle: "italic", fontSize: 13, color: COLORS.ink }}>
                {member.name}
              </Text>
              <Text style={{ fontSize: 9, color: COLORS.ink2, marginTop: 2 }}>
                Mất {String(day).padStart(2, "0")}/{String(month).padStart(2, "0")}/{year} · Đời {member.gen}
              </Text>
              <Text style={{ fontSize: 9, color: COLORS.ink3, fontStyle: "italic", marginTop: 1 }}>
                {lunar}
              </Text>
            </View>
          </View>
        ))}
      </View>

      <Text style={styles.pageNumber} render={({ pageNumber }) => `${pageNumber}`} fixed />
    </Page>
  );
}
```

- [ ] **Step 2: Wire + commit**

```tsx
{data.deceasedMembers.length > 0 && <CalendarPage deceased={data.deceasedMembers} />}
```

```bash
pnpm check && pnpm build
git add src/lib/heritage-book/pages/CalendarPage.tsx src/lib/heritage-book/index.tsx
git commit -m "feat(heritage HB5.2): CalendarPage — lịch giỗ deceased members sorted by month"
```

---

## Phase HB6 — Admin UI + endpoint

### Task 10: PDF endpoint

**Files:**
- Create: `src/pages/admin/heritage-book.pdf.ts`

- [ ] **Step 1: Implement**

```ts
/**
 * GET /admin/heritage-book.pdf
 *
 * Streams a generated PDF book based on query options:
 *   ?include_drafts=true|false (default false)
 *   ?include_album=true|false (default true)
 *   ?include_traditions=true|false (default true)
 *   ?lang=vi|en (default vi)
 *
 * Auth: admin or branch_editor only.
 */
import type { APIRoute } from "astro";
import React from "react";
import { renderToStream } from "@react-pdf/renderer";
import { ensureFonts } from "@/lib/heritage-book/fonts";
import { buildBookData } from "@/lib/heritage-book/data";
import { HeritageBook } from "@/lib/heritage-book";

export const prerender = false;

export const GET: APIRoute = async ({ url, locals }) => {
  const me = locals.user;
  if (!me || (me.role !== "admin" && me.role !== "branch_editor")) {
    return new Response("Forbidden", { status: 403 });
  }

  await ensureFonts();

  const includeDrafts = url.searchParams.get("include_drafts") === "true";
  const includeAlbum = url.searchParams.get("include_album") !== "false";
  const includeTraditions = url.searchParams.get("include_traditions") !== "false";
  const lang = (url.searchParams.get("lang") === "en" ? "en" : "vi") as "vi" | "en";

  const data = await buildBookData({
    includeDrafts,
    includePhotos: includeAlbum,
    includeTraditions,
    includeAlbum,
    lang,
  });

  const stream = await renderToStream(React.createElement(HeritageBook, { data }));

  // Convert Node Readable → Web ReadableStream for Astro Response
  const webStream = new ReadableStream({
    start(controller) {
      stream.on("data", (chunk) => controller.enqueue(chunk));
      stream.on("end", () => controller.close());
      stream.on("error", (err) => controller.error(err));
    },
  });

  const filename = `gia-pha-ho-${data.surname.toLowerCase()}-${data.publicationYear}.pdf`;
  return new Response(webStream, {
    status: 200,
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
};
```

- [ ] **Step 2: Verify + commit**

```bash
pnpm check && pnpm build
git add src/pages/admin/heritage-book.pdf.ts
git commit -m "feat(heritage HB6.1): GET /admin/heritage-book.pdf streaming endpoint"
```

---

### Task 11: Admin UI page

**Files:**
- Create: `src/pages/admin/heritage-book.astro`
- Modify: `src/components/admin/Sidebar.astro`

- [ ] **Step 1: Implement page**

```astro
---
export const prerender = false;

import AdminLayout from "@/layouts/AdminLayout.astro";
import { Card } from "@/components/ui/card";
import { getMembers, getQuotes, getTraditions, getPhotos } from "@/lib/content";
import { getDeceasedMembers } from "@/lib/memorial";

const me = Astro.locals.user;
if (!me || (me.role !== "admin" && me.role !== "branch_editor")) {
  return Astro.redirect("/admin");
}

const [allMembers, quotes, traditions, photos, deceased] = await Promise.all([
  getMembers(),
  getQuotes(),
  getTraditions(),
  getPhotos(),
  getDeceasedMembers(),
]);

const publishedMembers = allMembers.filter((m) => m.data.status === "published");
const featuredPhotos = photos.filter((p) => p.data.featured);
---

<AdminLayout title="Heritage Book" crumbs={[{ label: "Heritage Book" }]}>
  <header class="mb-6">
    <h1 class="text-title-md text-gray-800">📕 Heritage Book — Gia phả PDF</h1>
    <p class="text-sm text-gray-500 mt-1 max-w-prose">
      Tạo cuốn gia phả PDF in được, ~30-50 trang A4. Leverage 100% data hiện có:
      thành viên, ảnh, lời dặn, truyền thống, lịch giỗ.
    </p>
  </header>

  <section class="grid gap-6 lg:grid-cols-2">
    <Card className="p-5">
      <h2 class="text-base font-semibold mb-3">Thống kê</h2>
      <ul class="text-sm text-gray-700 space-y-1.5">
        <li>Thành viên đã xuất bản: <strong>{publishedMembers.length}</strong></li>
        <li>Thành viên nháp: <strong>{allMembers.length - publishedMembers.length}</strong></li>
        <li>Đã khuất (lịch giỗ): <strong>{deceased.length}</strong></li>
        <li>Ảnh featured: <strong>{featuredPhotos.length}</strong> / tổng {photos.length}</li>
        <li>Truyền thống: <strong>{traditions.length}</strong></li>
        <li>Lời dặn: <strong>{quotes.length}</strong></li>
      </ul>
      <p class="text-xs text-gray-500 mt-4">
        Ước tính: ~{4 + publishedMembers.length * 2 + Math.ceil(featuredPhotos.length / 6) + traditions.length + Math.ceil(quotes.length / 4) + 2} trang
      </p>
    </Card>

    <Card className="p-5">
      <h2 class="text-base font-semibold mb-3">Tuỳ chọn nội dung</h2>
      <form id="hb-form" class="space-y-3 text-sm">
        <label class="flex items-center gap-2">
          <input type="checkbox" name="include_drafts" value="true" />
          Bao gồm thành viên nháp
        </label>
        <label class="flex items-center gap-2">
          <input type="checkbox" name="include_album" value="true" checked />
          Bao gồm Album ảnh
        </label>
        <label class="flex items-center gap-2">
          <input type="checkbox" name="include_traditions" value="true" checked />
          Bao gồm Truyền thống
        </label>
        <div class="flex items-center gap-2">
          <span>Ngôn ngữ:</span>
          <select name="lang" class="rounded border px-2 py-1">
            <option value="vi" selected>Tiếng Việt</option>
            <option value="en">English</option>
          </select>
        </div>
        <div class="pt-3 flex gap-2">
          <button type="submit" class="rounded bg-brand-500 text-white px-4 py-2 text-sm font-medium hover:bg-brand-600">
            📕 Tải PDF
          </button>
          <button type="button" id="hb-preview" class="rounded border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50">
            🔍 Xem trước
          </button>
        </div>
      </form>

      <div id="hb-preview-frame" class="hidden mt-4 border border-gray-200 rounded">
        <iframe id="hb-iframe" class="w-full" style="height: 600px;"></iframe>
      </div>
    </Card>
  </section>

  <script is:inline>
    const form = document.getElementById("hb-form");
    const previewBtn = document.getElementById("hb-preview");
    const previewFrame = document.getElementById("hb-preview-frame");
    const iframe = document.getElementById("hb-iframe");

    function buildUrl() {
      const fd = new FormData(form);
      const params = new URLSearchParams();
      params.set("include_drafts", fd.get("include_drafts") ? "true" : "false");
      params.set("include_album", fd.get("include_album") ? "true" : "false");
      params.set("include_traditions", fd.get("include_traditions") ? "true" : "false");
      params.set("lang", String(fd.get("lang") || "vi"));
      return "/admin/heritage-book.pdf?" + params.toString();
    }

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      window.location.href = buildUrl();
    });

    previewBtn.addEventListener("click", () => {
      iframe.src = buildUrl();
      previewFrame.classList.remove("hidden");
    });
  </script>
</AdminLayout>
```

- [ ] **Step 2: Add sidebar entry**

In `src/components/admin/Sidebar.astro`, find the TƯỞNG NIỆM group `items: [...]`. Add as the LAST item in the group:

```astro
{ href: "/admin/heritage-book", label: "Heritage Book", iconKey: "image" /* or another icon */, adminOnly: false },
```

If no icon "book" exists, reuse "image" or "log".

- [ ] **Step 3: Verify + commit**

```bash
pnpm check && pnpm build
git add src/pages/admin/heritage-book.astro src/components/admin/Sidebar.astro
git commit -m "feat(heritage HB6.2): /admin/heritage-book UI — stats + options + preview/download"
```

---

## Phase HB7 — Polish + push

### Task 12: Smoke test + final commit

**Files:** none

- [ ] **Step 1: Run all quality gates**

```bash
pnpm test
pnpm check
pnpm check:no-cjk
pnpm build
```

All must pass.

- [ ] **Step 2: Manual smoke (if local dev runnable)**

Optional: `pnpm dev` → open `/admin/heritage-book` → click "Xem trước" → verify PDF loads in iframe → click "Tải PDF" → verify download triggers.

- [ ] **Step 3: Update memory**

Append session entry to `/home/mininja/.claude/projects/-home-mininja/memory/project_family_astro.md`:

```markdown
### Heritage Book session (2026-05-08) — what was built

1. **PDF generator**: `/admin/heritage-book.pdf` GET endpoint streams 30-50 page A4 PDF via @react-pdf/renderer. 7 page types (Cover, Foreword, ToC, LineageChart, MemberSpread × N, PhotoMosaic, TraditionPage × N, QuotesPage, CalendarPage, BackCover).
2. **Lib structure**: `src/lib/heritage-book/{fonts,styles,data,index}.tsx` + `pages/*.tsx` + `motifs/{LotusSeal,BlossomDivider}.tsx`. Reuses Vietnamese fonts via Font.register (Lora 600 + 400 italic, BeVietnamPro 400/600, DancingScript 600).
3. **Admin UI**: `/admin/heritage-book` shows data stats + content toggles (include_drafts, include_album, include_traditions, lang) + Tải PDF / Xem trước iframe preview. Sidebar entry added under TƯỞNG NIỆM.
4. **Reuse**: 100% data via existing getMembers/getQuotes/getTraditions/getPhotos + getDeceasedMembers + formatLunarVi from memorial lib. No new tables, no new migrations.

Effort: ~2.5 dev-days. 11 commits.
```

- [ ] **Step 4: Final empty marker commit + push**

```bash
git commit --allow-empty -m "chore(heritage): Phase 1 complete — PDF generator with admin UI"
git push
```

---

## Self-review

- [ ] PDF generates < 5s for 30-page book
- [ ] All Vietnamese diacritics render correctly
- [ ] Sepia portraits look warm
- [ ] Drop cap renders gold-2 first letter
- [ ] No CJK in source
- [ ] Admin can toggle drafts / photos / traditions
- [ ] Download triggers immediate browser download
- [ ] Sidebar nav has heritage book entry

---

**End of plan.**
