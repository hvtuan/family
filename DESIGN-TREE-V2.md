# DESIGN — Family Tree v2 (Hoành phi cuộn dọc)

**Status:** brainstorm complete (2026-05-08), implementation pending
**Predecessors:** `DESIGN.md`, `DESIGN-MEMORIAL.md`, `DESIGN-NOTIFICATIONS.md`, `DESIGN-HERITAGE-BOOK.md`
**Approach:** Pure vertical scroll + SVG watercolor connectors (no pan/zoom, no D3)
**Effort estimate:** ~2.5 dev-days, 7 phases (TV1-TV7)

---

## 1. Understanding Lock

### What
Replace `/family-tree` (current pan/zoom canvas at `src/components/react/FamilyTree.tsx`) với vertical-scroll calligraphy tree. Tổ tiên top, hậu duệ bottom. Watercolor SVG connectors. Hover member → side panel câu đối. Click → existing MemberModal.

### Why
- Current tree functional nhưng "Excel" feel — boxes + 90° elbows
- Visual moat per memorial brainstorm — screenshot share recognizable
- Aligned với Heritage Book / Memorial aesthetic: paper warm, gold-2 motifs
- Vertical scroll = mobile-first natural

### Who
- Public visitor (con cháu xa quê)
- Cô chú trên iPhone (scroll dễ hơn pan/zoom)

### Constraints
- Astro 6 SSR + React 19 (đã có)
- Tech naming EN, content VN (per project convention)
- ZERO Hán-Nôm trong asset (per `feedback_family_no_chinese_chars`)
- i18n-ready (gen labels qua catalog)
- Reuse: MemberModal, motion lib, getMembers, toClientMember
- KHÔNG D3 / react-flow / lib lớn — premature
- Replace existing FamilyTree.tsx (delete after wire-up; URL stable)

### Non-goals (defer)
- ❌ Pan/zoom controls
- ❌ Hán-Nôm calligraphy
- ❌ Mini-map navigation
- ❌ Search-in-tree (Cmd+K admin handles search)
- ❌ Edit-in-tree
- ❌ 3D/parallax effects
- ❌ Animation entrance (FOUC risk; just static render)

### NFR

| Aspect | Target |
|---|---|
| First paint | < 800ms TTFB cho 50 members |
| LCP (founder card) | < 1.5s |
| Scroll FPS | 60fps with SVG layer (test on iPhone 12+) |
| A11y | Keyboard: tab through member tiles, Enter opens modal |
| Mobile responsive | Single-column stack < 768px |

---

## 2. Decision Log

| # | Decision | Alternatives | Why |
|---|---|---|---|
| TV1 | Vertical scroll, gen rows top→bottom | Horizontal pan/zoom (current) | On-brand cuộn giấy; mobile-first |
| TV2 | Founder gen 1 = large centered card with lotus seal | Same size as gen 2+ | Honor founder; focal point |
| TV3 | Gen 2+ = small portrait tile (round 64-80px) + Lora name + dates | Card with photo + bio teaser | Compact, scannable |
| TV4 | SVG connectors curved bezier với jitter offset | Straight 90° elbows | Brush-stroke organic feel |
| TV5 | Connector gradient gold-2 → gold-3, stroke 1.5-2px | Solid color | Warm, hand-drawn |
| TV6 | Hover → side câu đối panel với role + dates + hometown | Tooltip on top | More dignified, fits theme |
| TV7 | Generation divider = gold rule + ❀ blossom + "Đời thứ N" label | Plain spacing | Pacing + visual rhythm |
| TV8 | Background: u-paper-texture + faint side borders | Solid color | Heritage atmosphere |
| TV9 | Mobile: single-column stack | Squeeze grid | Thumb-friendly |
| TV10 | Desktop: flex row centered, wraps if too many in gen | Fixed grid | Dynamic gen sizes (1, 2, 6, 12) |
| TV11 | Click → existing MemberModal | New modal | Reuse |
| TV12 | NO pan/zoom | Keep current logic | Simpler, more on-brand |
| TV13 | Couple units (spouse adjacent) per gen | Solo only | Brand "gia phả" — full family |
| TV14 | Replace FamilyTree.tsx | Coexist | URL stable; old deprecated |
| TV15 | Pure CSS grid for gen rows; SVG layer absolute positioned for connectors | Canvas/D3 | Simpler, no lib |
| TV16 | Connectors compute via DOM measure after first paint | Pre-compute layout | DOM measure handles wraps + responsiveness |
| TV17 | KHÔNG zoom controls | +/− buttons | Browser default Cmd+Scroll works for those who need it |

---

## 3. Architecture

```
┌────────────────────────────────────────────────────────────────────┐
│                  /family-tree (Astro shell)                         │
│  src/pages/family-tree.astro — SSR fetch members, pass to React     │
└────────────────────────────────────────────────────────────────────┘
                              │
                              ▼ <FamilyTreeScroll members={...} />
┌────────────────────────────────────────────────────────────────────┐
│              ROOT: src/components/react/FamilyTreeScroll.tsx        │
│  - computeLayout(members) → { rows, links }                         │
│  - render <FounderCard> + map gen rows + <Connectors>               │
│  - hover state → <HoverPanel>                                        │
│  - click → $modalMember.set(member)                                  │
└────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────────┐
│         SUBCOMPONENTS: src/components/react/family-tree-scroll/    │
│  layout.ts          computeLayout() pure function                   │
│  FounderCard.tsx    gen 1 large card                                │
│  MemberTile.tsx     gen 2+ small tile                               │
│  CoupleUnit.tsx     wraps 2 tiles for spouse pairs                  │
│  GenerationDivider  ❀ + label                                       │
│  HoverPanel.tsx     side câu đối reveal                             │
│  Connectors.tsx     SVG layer with bezier paths                     │
└────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌────────────────────────────────────────────────────────────────────┐
│                  EXTERNAL                                            │
│  $modalMember nanostore → MemberModal (mounted in Base.astro)       │
└────────────────────────────────────────────────────────────────────┘
```

---

## 4. Layout algorithm (`layout.ts`)

```ts
export interface LayoutRow {
  gen: number;
  units: LayoutUnit[];
}

export interface LayoutUnit {
  // anchor member is the blood-line member; spouse is optional
  anchor: ClientMember;
  spouse: ClientMember | null;
  // child unit ids (anchor.id of next-gen units)
  childIds: string[];
}

export function computeLayout(members: ClientMember[]): LayoutRow[] {
  // 1. Group by gen
  // 2. Within each gen, build couple units:
  //    - Iterate, skip already-paired
  //    - If member.spouse exists in same gen → pair as couple
  //    - Else solo
  // 3. Compute parent → child unit relationships
  //    - For each member, parent = father_id ?? mother_id
  //    - Look up parent's unit, add this unit to childIds
  // 4. Order units within row by birth_order of anchor
  // 5. Return rows in gen ASC order
  ...
}
```

Connector positions are computed AFTER initial render via DOM `getBoundingClientRect()` — handles flex-wrap on different viewport widths.

---

## 5. Component spec

### `FounderCard` (gen 1)

```
┌─────────────────────────┐
│   [LotusSeal small]      │
│                          │
│  Cụ Nguyễn Văn Tổ        │  ← Lora italic 32pt
│                          │
│   1900 — 1980            │  ← BeVietnamPro tabular 12pt
│   Tịnh Khê, Quảng Ngãi   │  ← italic ink-3
│                          │
│   ⊛  Tộc trưởng           │  ← vermilion stamp small
│                          │
└─────────────────────────┘
```

- Width: 320px desktop, full-width mobile
- Border: 1px gold-2/40 with corner accents
- Background: cream
- Padding: 32px

### `MemberTile` (gen 2+)

```
┌──────────┐
│ [photo]  │  ← rounded-full 64-80px sepia
│          │
│ Tên Lora │  ← italic 14pt center
│ '78–'24  │  ← BeVietnamPro 10pt
└──────────┘
```

- Width: 120px (or 160px in `<CoupleUnit>`)
- Hover: subtle scale 1.04 + gold glow
- Click: opens MemberModal
- Tab focusable

### `CoupleUnit`

Wraps 2 tiles side-by-side với connector "♡" symbol or thin gold rule between.

### `GenerationDivider`

```
─────────────  ❀  Đời thứ 2  ❀  ─────────────
```

Full-width, gold-2 rule, ❀ at center + label.

### `HoverPanel` (câu đối)

Slides in from right edge of viewport (or LEFT if hovered tile is on right side):

```
┌─────────────────────┐
│ Cụ Nguyễn Văn A     │
│ Tộc trưởng đời 2    │
│                     │
│ Sinh: 1925          │
│ Mất:  1990          │
│ Quê: Tịnh Khê       │
│                     │
│ Cha: Cụ Tổ          │
│ Vợ:  Bà Lan         │
│ Con: 4 người        │
└─────────────────────┘
```

Uses motion `slide-from-right` 220ms ease-out.

### `Connectors`

SVG element absolutely positioned over the tree, full-width, full-height.
- Computes path from each parent unit center-bottom → each child unit center-top
- Path: cubic bezier with control points offset for natural curve
- Optional jitter: ±2px on control points for hand-drawn feel
- Stroke: `url(#tree-gradient-gold)` 1.5px
- Opacity 0.7

```svg
<svg style="position: absolute; inset: 0; pointer-events: none">
  <defs>
    <linearGradient id="tree-gradient-gold" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="var(--color-gold-2)" />
      <stop offset="100%" stop-color="var(--color-gold-3)" />
    </linearGradient>
  </defs>
  {paths.map(p => <path d={p.d} stroke="url(#tree-gradient-gold)" stroke-width="1.5" fill="none" />)}
</svg>
```

---

## 6. Phasing

| Phase | Scope | Effort |
|---|---|---|
| **TV1** Layout + skeleton | install scaffold; computeLayout; FounderCard + MemberTile + CoupleUnit; gen rows render w/o connectors | 0.5d |
| **TV2** Connectors | SVG layer; bezier path generator; gradient + jitter | 0.4d |
| **TV3** Hover panel | HoverPanel component; motion slide; debounce | 0.4d |
| **TV4** Decorations | GenerationDivider; paper texture; side borders | 0.4d |
| **TV5** Mobile responsive | single-column stack < 768px; vertical connectors | 0.3d |
| **TV6** Replace + cleanup | wire into family-tree.astro; delete old FamilyTree.tsx; update PageHead copy | 0.3d |
| **TV7** Polish + push | QA, memory update, smoke, push | 0.3d |

Total **~2.5-3 dev-days, 11 tasks**.

---

## 7. Risks + mitigations

| Risk | L | I | Mitigation |
|---|---|---|---|
| Connector paths misalign on flex-wrap | M | M | DOM measure after render via useEffect + ResizeObserver |
| Mobile portrait too tall (50 members) | M | L | OK — pure scroll handles infinite height; lazy-render images |
| Hover panel covers other tiles on small screens | M | M | Disable hover panel < 1024px; use Click/touch to expand |
| Old FamilyTree.tsx deletion breaks imports | L | M | Grep before delete; remove imports from family-tree.astro |
| SVG connectors stutter on iPhone Safari | L | M | Limit jitter complexity; use `transform: translateZ(0)` to GPU-promote |

---

## 8. Acceptance criteria

- [ ] `/family-tree` shows founder centered top + descendants flowing down
- [ ] Connectors curved bezier with gold gradient (no 90° elbows)
- [ ] Hover desktop → side panel reveals member info
- [ ] Click any tile → existing MemberModal opens
- [ ] Mobile (< 768px): single-column stack, scroll smooth
- [ ] Couple units (spouse pairs) shown side-by-side
- [ ] Generation dividers visible between rows
- [ ] No CJK in source
- [ ] 0 type errors, 48+ tests still pass
- [ ] Old FamilyTree.tsx deleted, no orphan imports

---

## 9. Out of scope (defer)

- Pan/zoom controls
- Hán-Nôm or chữ Hán
- Mini-map
- Search/filter inside tree
- Edit-in-tree
- 3D parallax / scroll animations
- Lazy-load below fold (50 members renders fine eagerly)
- Multi-volume (split by branch)
- Print-friendly CSS for tree

---

## 10. References

- `DESIGN-MEMORIAL.md`
- `DESIGN-HERITAGE-BOOK.md` (LotusSeal motif pattern reused)
- `src/components/react/FamilyTree.tsx` (current — will be deleted)
- `src/stores/ui.ts` ($modalMember nanostore)
- Memory: `feedback_family_memorial_tone.md`
- Memory: `feedback_family_no_chinese_chars.md`
- Memory: `feedback_prefer_proven_libs.md`
