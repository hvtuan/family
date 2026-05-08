# Family Tree v2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `/family-tree` (current pan/zoom canvas) với vertical-scroll calligraphy tree với watercolor SVG connectors, hover câu đối panel, click → MemberModal. Aesthetic alignment với Heritage Book + Memorial layer.

**Architecture:** Pure React + SVG (no D3 / react-flow). Layout = pure function `members → rows[]`. Connectors computed via DOM measure after first paint. Hover state local to root.

**Tech Stack:** Astro 6 SSR + React 19 + Tailwind v4 + `motion` (framer-motion v11) — all already installed. No new deps.

**Spec source:** `DESIGN-TREE-V2.md`

---

## Phase TV1 — Layout + skeleton

### Task 1: Folder scaffold + computeLayout pure function

**Files:**
- Create: `src/components/react/family-tree-scroll/layout.ts`
- Create: `src/components/react/family-tree-scroll/layout.test.ts`

- [ ] **Step 1: Write failing test**

```ts
import { describe, it, expect } from "vitest";
import { computeLayout } from "./layout";
import type { ClientMember } from "@/lib/members-client";

const m = (overrides: Partial<ClientMember>): ClientMember => ({
  id: "x", name: "X", gen: 1, role: "Tổ", roleEn: "Founder",
  isFamilyHead: false, born: "1900", died: null,
  bio: "", bioEn: "", hobbies: [], children: [],
  achievements: [], anecdotes: [], tags: [],
  ...overrides,
} as ClientMember);

describe("computeLayout", () => {
  it("returns empty rows for empty input", () => {
    expect(computeLayout([])).toEqual([]);
  });

  it("groups by gen ascending", () => {
    const rows = computeLayout([
      m({ id: "a", gen: 2 }),
      m({ id: "b", gen: 1 }),
      m({ id: "c", gen: 3 }),
    ]);
    expect(rows.map((r) => r.gen)).toEqual([1, 2, 3]);
  });

  it("pairs spouse couples into single units", () => {
    const rows = computeLayout([
      m({ id: "a", gen: 2, spouse: "b" }),
      m({ id: "b", gen: 2, spouse: "a" }),
    ]);
    expect(rows[0].units).toHaveLength(1);
    expect(rows[0].units[0].anchor.id).toBe("a");
    expect(rows[0].units[0].spouse?.id).toBe("b");
  });

  it("orders units by anchor birth_order", () => {
    const rows = computeLayout([
      m({ id: "a", gen: 1, birthOrder: 3 }),
      m({ id: "b", gen: 1, birthOrder: 1 }),
      m({ id: "c", gen: 1, birthOrder: 2 }),
    ]);
    expect(rows[0].units.map((u) => u.anchor.id)).toEqual(["b", "c", "a"]);
  });

  it("links parent unit to child unit via father/mother", () => {
    const rows = computeLayout([
      m({ id: "p", gen: 1 }),
      m({ id: "c", gen: 2, father: "p" }),
    ]);
    expect(rows[0].units[0].childIds).toEqual(["c"]);
  });
});
```

- [ ] **Step 2: Run test (fails)**

```bash
cd /home/mininja/Github/family
pnpm test src/components/react/family-tree-scroll/layout.test.ts
```

Expected: FAIL — `Cannot find module './layout'`.

- [ ] **Step 3: Implement `layout.ts`**

```ts
/**
 * Pure-function layout for FamilyTreeScroll.
 *
 * members[] → rows[] where each row = a generation; each row has units;
 * each unit = anchor member + optional spouse + child unit ids.
 *
 * Layout decisions:
 *   - rows ordered by gen ASC
 *   - units within row ordered by anchor.birth_order ASC
 *   - couples pair adjacent same-gen members where m.spouse points to a
 *     same-gen member who isn't already paired
 *   - parent of a unit's anchor → that anchor's parent unit; childIds
 *     bubble up to the parent unit
 */
import type { ClientMember } from "@/lib/members-client";

export interface LayoutUnit {
  anchor: ClientMember;
  spouse: ClientMember | null;
  childIds: string[];
}

export interface LayoutRow {
  gen: number;
  units: LayoutUnit[];
}

export function computeLayout(members: ClientMember[]): LayoutRow[] {
  if (members.length === 0) return [];

  const byId = new Map(members.map((m) => [m.id, m]));

  // Group by gen
  const byGen = new Map<number, ClientMember[]>();
  for (const m of members) {
    if (!byGen.has(m.gen)) byGen.set(m.gen, []);
    byGen.get(m.gen)!.push(m);
  }
  for (const list of byGen.values()) {
    list.sort((a, b) => (a.birthOrder ?? 99) - (b.birthOrder ?? 99));
  }

  // Build units within each gen
  const unitOfMember = new Map<string, string>(); // memberId → unit anchor id
  const unitsByGen = new Map<number, LayoutUnit[]>();

  for (const [gen, list] of byGen) {
    const used = new Set<string>();
    const units: LayoutUnit[] = [];

    for (const m of list) {
      if (used.has(m.id)) continue;
      const partner =
        m.spouse && byId.get(m.spouse) && byId.get(m.spouse)!.gen === gen && !used.has(m.spouse)
          ? byId.get(m.spouse)!
          : null;
      const unit: LayoutUnit = { anchor: m, spouse: partner, childIds: [] };
      units.push(unit);
      used.add(m.id);
      unitOfMember.set(m.id, m.id);
      if (partner) {
        used.add(partner.id);
        unitOfMember.set(partner.id, m.id);
      }
    }
    unitsByGen.set(gen, units);
  }

  // Wire parent→child linkages
  for (const m of members) {
    const parentMemberId = m.father ?? m.mother;
    if (!parentMemberId) continue;
    const parentUnitId = unitOfMember.get(parentMemberId);
    if (!parentUnitId) continue;
    const parentGen = byId.get(parentMemberId)!.gen;
    const parentUnits = unitsByGen.get(parentGen) ?? [];
    const parentUnit = parentUnits.find((u) => u.anchor.id === parentUnitId);
    if (parentUnit && !parentUnit.childIds.includes(m.id)) {
      parentUnit.childIds.push(m.id);
    }
  }

  // Compose rows
  const rows: LayoutRow[] = Array.from(unitsByGen.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([gen, units]) => ({ gen, units }));

  return rows;
}
```

- [ ] **Step 4: Run tests (pass)**

```bash
pnpm test src/components/react/family-tree-scroll/layout.test.ts
```

Expected: 5/5 pass.

- [ ] **Step 5: Commit**

```bash
git add src/components/react/family-tree-scroll/layout.ts src/components/react/family-tree-scroll/layout.test.ts
git commit -m "feat(tree-v2 TV1.1): computeLayout pure function — gen rows + couple units + parent links"
```

---

### Task 2: FounderCard + MemberTile + CoupleUnit components

**Files:**
- Create: `src/components/react/family-tree-scroll/FounderCard.tsx`
- Create: `src/components/react/family-tree-scroll/MemberTile.tsx`
- Create: `src/components/react/family-tree-scroll/CoupleUnit.tsx`

- [ ] **Step 1: FounderCard**

```tsx
import { $modalMember } from "@/stores/ui";
import type { ClientMember } from "@/lib/members-client";

interface Props { member: ClientMember; }

function years(m: ClientMember): string {
  const b = m.born ? new Date(m.born).getFullYear() : null;
  const d = m.died ? new Date(m.died).getFullYear() : null;
  if (b && d) return `${b} — ${d}`;
  if (b) return `${b} — nay`;
  return "—";
}

export default function FounderCard({ member }: Props) {
  return (
    <button
      type="button"
      onClick={() => $modalMember.set(member)}
      className="group relative block w-[320px] rounded-md border border-gold-2/40 bg-cream/70 p-8 shadow-[0_24px_60px_-30px_rgba(120,80,40,0.35)] hover:shadow-[0_24px_60px_-20px_rgba(120,80,40,0.5)] transition-all text-left"
      aria-label={`Mở chi tiết về ${member.name}`}
    >
      {/* Lotus seal accent top-right */}
      <span aria-hidden="true" className="absolute right-4 top-4 text-2xl text-gold-2/40">🪷</span>

      <p className="u-kicker mb-3">Tổ tiên</p>
      <h3
        className="font-display italic text-ink m-0"
        style={{ fontSize: "var(--text-3xl)", lineHeight: 1.1 }}
      >
        {member.name}
      </h3>

      {member.role && (
        <p className="mt-2 text-sm text-ink-2 m-0">{member.role}{member.isFamilyHead ? " · Tộc trưởng" : ""}</p>
      )}

      <p className="mt-3 text-sm text-ink-3 tabular-nums m-0">{years(member)}</p>
      {member.birthPlace && (
        <p className="mt-1 text-xs italic text-ink-3 m-0">{member.birthPlace}</p>
      )}

      {member.isFamilyHead && (
        <span className="absolute right-6 bottom-6 text-vermilion text-2xl opacity-70" aria-hidden="true">⊛</span>
      )}
    </button>
  );
}
```

- [ ] **Step 2: MemberTile**

```tsx
import { $modalMember } from "@/stores/ui";
import type { ClientMember } from "@/lib/members-client";

interface Props {
  member: ClientMember;
  onHover?: (m: ClientMember | null) => void;
}

export default function MemberTile({ member, onHover }: Props) {
  const initial = member.name.trim().slice(0, 1);
  const b = member.born ? new Date(member.born).getFullYear() : null;
  const d = member.died ? new Date(member.died).getFullYear() : null;
  const dates = b && d ? `${b}–${d}` : b ? `'${String(b).slice(2)}–nay` : "";

  return (
    <button
      type="button"
      onClick={() => $modalMember.set(member)}
      onMouseEnter={() => onHover?.(member)}
      onMouseLeave={() => onHover?.(null)}
      onFocus={() => onHover?.(member)}
      onBlur={() => onHover?.(null)}
      className="group flex flex-col items-center gap-2 w-[120px] py-2 px-1 rounded-md hover:bg-cream/60 transition-colors text-center"
      aria-label={`Xem chi tiết ${member.name}`}
    >
      <span
        className="block size-16 overflow-hidden rounded-full border border-gold-2/40 group-hover:border-vermilion/60 transition-colors"
        style={{ filter: "sepia(0.18) saturate(0.9)" }}
      >
        {member.photo ? (
          <img src={member.photo} alt="" className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <span className="flex w-full h-full items-center justify-center bg-paper-2/40 text-gold-2/60 font-display italic text-xl">
            {initial}
          </span>
        )}
      </span>
      <span className="font-display italic text-ink text-sm leading-tight m-0 truncate max-w-full">
        {member.name}
      </span>
      {dates && (
        <span className="text-[10px] text-ink-3 tabular-nums m-0">{dates}</span>
      )}
    </button>
  );
}
```

- [ ] **Step 3: CoupleUnit**

```tsx
import MemberTile from "./MemberTile";
import type { ClientMember } from "@/lib/members-client";

interface Props {
  anchor: ClientMember;
  spouse: ClientMember | null;
  onHover?: (m: ClientMember | null) => void;
}

export default function CoupleUnit({ anchor, spouse, onHover }: Props) {
  if (!spouse) {
    return (
      <div data-unit-id={anchor.id} className="flex justify-center">
        <MemberTile member={anchor} onHover={onHover} />
      </div>
    );
  }
  return (
    <div data-unit-id={anchor.id} className="flex items-center gap-1 px-2">
      <MemberTile member={anchor} onHover={onHover} />
      <span aria-hidden="true" className="text-gold-2/60 self-center text-base">♡</span>
      <MemberTile member={spouse} onHover={onHover} />
    </div>
  );
}
```

- [ ] **Step 4: Type-check**

```bash
pnpm check 2>&1 | grep -E "tree-scroll" | head -10
```

Expect zero errors related to these 3 files.

- [ ] **Step 5: Commit**

```bash
git add src/components/react/family-tree-scroll/FounderCard.tsx src/components/react/family-tree-scroll/MemberTile.tsx src/components/react/family-tree-scroll/CoupleUnit.tsx
git commit -m "feat(tree-v2 TV1.2): FounderCard + MemberTile + CoupleUnit components"
```

---

### Task 3: Root FamilyTreeScroll component (no connectors yet)

**Files:**
- Create: `src/components/react/FamilyTreeScroll.tsx`

- [ ] **Step 1: Implement root**

```tsx
import { useState } from "react";
import type { ClientMember } from "@/lib/members-client";
import { computeLayout } from "./family-tree-scroll/layout";
import FounderCard from "./family-tree-scroll/FounderCard";
import CoupleUnit from "./family-tree-scroll/CoupleUnit";

interface Props { members: ClientMember[]; }

export default function FamilyTreeScroll({ members }: Props) {
  const rows = computeLayout(members);
  // hover state surfaced for HoverPanel (T6 wires it)
  const [, setHovered] = useState<ClientMember | null>(null);

  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-line bg-cream/40 p-12 text-center">
        <p className="text-base text-ink-3 m-0">Chưa có dữ liệu thành viên.</p>
      </div>
    );
  }

  return (
    <div className="relative" data-tree-scroll>
      {rows.map((row, idx) => {
        const isFounderRow = idx === 0 && row.units.length === 1 && !row.units[0].spouse;
        return (
          <div key={row.gen} className="relative">
            {idx > 0 && (
              <div
                className="my-10 flex items-center justify-center gap-3 text-gold-2/60"
                aria-hidden="true"
              >
                <span className="h-px flex-1 max-w-[180px] bg-gold-2/40" />
                <span className="text-base">❀</span>
                <span className="font-display italic text-sm text-ink-3 px-2">Đời thứ {row.gen}</span>
                <span className="text-base">❀</span>
                <span className="h-px flex-1 max-w-[180px] bg-gold-2/40" />
              </div>
            )}

            {isFounderRow ? (
              <div className="flex justify-center">
                <FounderCard member={row.units[0].anchor} />
              </div>
            ) : (
              <div className="flex flex-wrap justify-center gap-x-4 gap-y-6">
                {row.units.map((u) => (
                  <CoupleUnit
                    key={u.anchor.id}
                    anchor={u.anchor}
                    spouse={u.spouse}
                    onHover={setHovered}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Type-check + build**

```bash
pnpm check
pnpm build
```

Expect 0 errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/react/FamilyTreeScroll.tsx
git commit -m "feat(tree-v2 TV1.3): FamilyTreeScroll root — gen rows + dividers (no connectors yet)"
```

---

## Phase TV2 — Watercolor connectors

### Task 4: Connectors SVG layer with curved bezier paths

**Files:**
- Create: `src/components/react/family-tree-scroll/Connectors.tsx`
- Modify: `src/components/react/FamilyTreeScroll.tsx` to use it

- [ ] **Step 1: Implement Connectors**

```tsx
import { useEffect, useState } from "react";
import type { LayoutRow } from "./layout";

interface Props {
  rows: LayoutRow[];
  containerRef: React.RefObject<HTMLDivElement | null>;
}

interface PathSpec { d: string; }

/**
 * After the tree renders, measure each unit's DOM position via
 * data-unit-id="<anchor.id>" attribute, then build cubic bezier paths
 * from each parent unit's bottom-center to each child unit's top-center.
 *
 * Re-runs on window resize via ResizeObserver so wraps update correctly.
 */
export default function Connectors({ rows, containerRef }: Props) {
  const [paths, setPaths] = useState<PathSpec[]>([]);
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    function compute() {
      if (!container) return;
      const containerRect = container.getBoundingClientRect();
      setSize({ w: containerRect.width, h: containerRect.height });

      const units = container.querySelectorAll<HTMLElement>("[data-unit-id]");
      const positions = new Map<string, { x: number; yTop: number; yBottom: number }>();
      for (const el of units) {
        const id = el.dataset.unitId!;
        const r = el.getBoundingClientRect();
        positions.set(id, {
          x: r.left + r.width / 2 - containerRect.left,
          yTop: r.top - containerRect.top,
          yBottom: r.bottom - containerRect.top,
        });
      }

      const out: PathSpec[] = [];
      for (const row of rows) {
        for (const u of row.units) {
          const parentPos = positions.get(u.anchor.id);
          if (!parentPos) continue;
          for (const childMemberId of u.childIds) {
            // Child anchor unit may live under a different anchor id (the
            // child's own unit) — find it by scanning the next gen.
            const childUnitId = findUnitIdForMember(rows, row.gen + 1, childMemberId);
            if (!childUnitId) continue;
            const childPos = positions.get(childUnitId);
            if (!childPos) continue;
            out.push({ d: bezierPath(parentPos.x, parentPos.yBottom, childPos.x, childPos.yTop) });
          }
        }
      }
      setPaths(out);
    }

    compute();
    const ro = new ResizeObserver(compute);
    ro.observe(container);
    window.addEventListener("resize", compute);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", compute);
    };
  }, [rows, containerRef]);

  if (paths.length === 0) return null;

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      width={size.w}
      height={size.h}
      style={{ overflow: "visible" }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="tree-gradient-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-gold-2)" stopOpacity="0.85" />
          <stop offset="100%" stopColor="var(--color-gold-3)" stopOpacity="0.6" />
        </linearGradient>
      </defs>
      {paths.map((p, i) => (
        <path key={i} d={p.d} stroke="url(#tree-gradient-gold)" strokeWidth={1.5} fill="none" strokeLinecap="round" />
      ))}
    </svg>
  );
}

function bezierPath(x1: number, y1: number, x2: number, y2: number): string {
  // Cubic bezier with control points offset vertically for soft curve.
  // Slight horizontal jitter on midpoint for hand-drawn feel.
  const midY = (y1 + y2) / 2;
  const jitter = ((x1 + x2) % 7) - 3; // deterministic ±3px
  const cp1x = x1 + jitter;
  const cp1y = midY;
  const cp2x = x2 - jitter;
  const cp2y = midY;
  return `M ${x1} ${y1} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${x2} ${y2}`;
}

function findUnitIdForMember(rows: LayoutRow[], gen: number, memberId: string): string | null {
  const row = rows.find((r) => r.gen === gen);
  if (!row) return null;
  for (const u of row.units) {
    if (u.anchor.id === memberId || u.spouse?.id === memberId) return u.anchor.id;
  }
  return null;
}
```

- [ ] **Step 2: Wire into FamilyTreeScroll**

Modify `src/components/react/FamilyTreeScroll.tsx`:

```tsx
import { useRef, useState } from "react";
// ... existing imports
import Connectors from "./family-tree-scroll/Connectors";

export default function FamilyTreeScroll({ members }: Props) {
  const rows = computeLayout(members);
  const [, setHovered] = useState<ClientMember | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  if (rows.length === 0) { /* ... existing empty state */ }

  return (
    <div ref={containerRef} className="relative" data-tree-scroll>
      <Connectors rows={rows} containerRef={containerRef} />
      {/* existing rows.map(...) */}
    </div>
  );
}
```

- [ ] **Step 3: Type-check + build**

```bash
pnpm check && pnpm build
```

Expect 0 errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/react/family-tree-scroll/Connectors.tsx src/components/react/FamilyTreeScroll.tsx
git commit -m "feat(tree-v2 TV2): SVG watercolor connectors — bezier curves + gold gradient"
```

---

## Phase TV3 — Hover panel

### Task 5: HoverPanel câu đối side reveal

**Files:**
- Create: `src/components/react/family-tree-scroll/HoverPanel.tsx`
- Modify: `src/components/react/FamilyTreeScroll.tsx`

- [ ] **Step 1: HoverPanel**

```tsx
import { motion, AnimatePresence } from "motion/react";
import type { ClientMember } from "@/lib/members-client";

interface Props {
  member: ClientMember | null;
  members: ClientMember[];
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

export default function HoverPanel({ member, members }: Props) {
  const byId = new Map(members.map((m) => [m.id, m]));
  const father = member?.father ? byId.get(member.father) : null;
  const mother = member?.mother ? byId.get(member.mother) : null;
  const spouse = member?.spouse ? byId.get(member.spouse) : null;
  const childrenCount = member ? members.filter((m) => m.father === member.id || m.mother === member.id).length : 0;

  return (
    <AnimatePresence>
      {member && (
        <motion.aside
          key={member.id}
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 16 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className="hidden lg:block fixed right-6 top-32 w-[280px] rounded-md border border-gold-2/40 bg-cream/95 backdrop-blur p-5 shadow-paper-2 z-40 pointer-events-none"
          role="complementary"
          aria-live="polite"
        >
          <p className="u-kicker mb-2">{member.role}{member.isFamilyHead ? " · Tộc trưởng" : ""}</p>
          <h4 className="font-display italic text-ink m-0" style={{ fontSize: "var(--text-xl)" }}>
            {member.name}
          </h4>

          <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
            {member.born && (
              <>
                <dt className="text-ink-3">Sinh</dt>
                <dd className="text-ink-2 tabular-nums m-0">{formatDate(member.born)}</dd>
              </>
            )}
            {member.died && (
              <>
                <dt className="text-ink-3">Mất</dt>
                <dd className="text-ink-2 tabular-nums m-0">{formatDate(member.died)}</dd>
              </>
            )}
            {member.birthPlace && (
              <>
                <dt className="text-ink-3">Quê</dt>
                <dd className="text-ink-2 m-0">{member.birthPlace}</dd>
              </>
            )}
            {father && (
              <>
                <dt className="text-ink-3">Cha</dt>
                <dd className="text-ink-2 m-0 italic">{father.name}</dd>
              </>
            )}
            {mother && (
              <>
                <dt className="text-ink-3">Mẹ</dt>
                <dd className="text-ink-2 m-0 italic">{mother.name}</dd>
              </>
            )}
            {spouse && (
              <>
                <dt className="text-ink-3">Vợ/Chồng</dt>
                <dd className="text-ink-2 m-0 italic">{spouse.name}</dd>
              </>
            )}
            {childrenCount > 0 && (
              <>
                <dt className="text-ink-3">Con</dt>
                <dd className="text-ink-2 m-0">{childrenCount} người</dd>
              </>
            )}
          </dl>

          <p className="mt-4 text-[10px] italic text-ink-3 m-0">Bấm vào để xem đầy đủ →</p>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
```

- [ ] **Step 2: Wire into root**

In `FamilyTreeScroll.tsx`, replace the `[, setHovered]` ignore-first with full state and render `<HoverPanel>`:

```tsx
const [hovered, setHovered] = useState<ClientMember | null>(null);

return (
  <div ref={containerRef} className="relative" data-tree-scroll>
    <Connectors rows={rows} containerRef={containerRef} />
    {/* rows.map(...) */}
    <HoverPanel member={hovered} members={members} />
  </div>
);
```

- [ ] **Step 3: Build verify + commit**

```bash
pnpm check && pnpm build
git add src/components/react/family-tree-scroll/HoverPanel.tsx src/components/react/FamilyTreeScroll.tsx
git commit -m "feat(tree-v2 TV3): HoverPanel câu đối side reveal with motion slide-from-right"
```

---

## Phase TV4 — Decorations + paper texture

### Task 6: Apply paper texture + side mây triện borders + page wrapper styling

**Files:**
- Modify: `src/pages/family-tree.astro`

- [ ] **Step 1: Update page shell**

Read existing `src/pages/family-tree.astro` first. Replace its body with the new wrapper:

```astro
---
export const prerender = false;
import Base from "@/layouts/Base.astro";
import PageHead from "@/components/astro/PageHead.astro";
import FamilyTreeScroll from "@/components/react/FamilyTreeScroll";
import { getMembers } from "@/lib/content";
import { toClientMember } from "@/lib/members-client";

const all = await getMembers((entry) => entry.data.status === "published");
const clientMembers = all.map(toClientMember);
---

<Base title="Cây gia phả" pageKey="family-tree">
  <PageHead
    kicker="Family Tree"
    title="Cây gia phả"
    subtitle="Cuộn từ trên xuống — bấm vào ai đó để xem chi tiết."
    subtitleEn="Scroll from founder down · click to open"
  />
  <section class="relative max-w-[1240px] mx-auto px-4 sm:px-8 pt-2 pb-24 u-paper-texture">
    <!-- Side mây triện borders (decorative) -->
    <div
      aria-hidden="true"
      class="hidden md:block absolute left-0 top-12 bottom-12 w-3 opacity-25"
      style="background: repeating-linear-gradient(180deg, var(--color-gold-3) 0 8px, transparent 8px 24px);"
    ></div>
    <div
      aria-hidden="true"
      class="hidden md:block absolute right-0 top-12 bottom-12 w-3 opacity-25"
      style="background: repeating-linear-gradient(180deg, var(--color-gold-3) 0 8px, transparent 8px 24px);"
    ></div>

    <FamilyTreeScroll members={clientMembers} client:load />
  </section>
</Base>
```

- [ ] **Step 2: Build verify + commit**

```bash
pnpm check && pnpm build
git add src/pages/family-tree.astro
git commit -m "feat(tree-v2 TV4): page shell — paper texture + side mây triện borders + new copy"
```

---

## Phase TV5 — Mobile responsive

### Task 7: Mobile single-column polish

**Files:**
- Modify: `src/components/react/family-tree-scroll/MemberTile.tsx`
- Modify: `src/components/react/family-tree-scroll/CoupleUnit.tsx`
- Modify: `src/components/react/FamilyTreeScroll.tsx`

- [ ] **Step 1: Tweak responsive widths**

In `MemberTile.tsx`: change `w-[120px]` to `w-[110px] sm:w-[120px]` and add `md:w-[130px]` if desired.

In `CoupleUnit.tsx`: ensure couple wraps properly on small screens (already wraps via `flex-wrap` parent).

In `FamilyTreeScroll.tsx` row container, change gap-x for mobile:
```tsx
<div className="flex flex-wrap justify-center gap-x-2 sm:gap-x-4 gap-y-6">
```

Connectors (T4) already use ResizeObserver — they re-compute on viewport change automatically.

- [ ] **Step 2: HoverPanel hidden on mobile**

HoverPanel already has `hidden lg:block` — confirms desktop-only. Mobile users tap → modal directly.

- [ ] **Step 3: Build verify + commit**

```bash
pnpm check && pnpm build
git add src/components/react/family-tree-scroll/MemberTile.tsx src/components/react/family-tree-scroll/CoupleUnit.tsx src/components/react/FamilyTreeScroll.tsx
git commit -m "feat(tree-v2 TV5): mobile responsive tweaks — narrower tiles + tighter gap"
```

---

## Phase TV6 — Replace + cleanup

### Task 8: Delete old FamilyTree.tsx + verify no stale imports

**Files:**
- Delete: `src/components/react/FamilyTree.tsx`

- [ ] **Step 1: Grep for any remaining import**

```bash
grep -rn "from \"@/components/react/FamilyTree\"" src/ --include="*.astro" --include="*.tsx" --include="*.ts" | grep -v FamilyTreeScroll
```

Expected: empty (already replaced in T6 page edit).

- [ ] **Step 2: Delete old file**

```bash
rm src/components/react/FamilyTree.tsx
```

- [ ] **Step 3: Build verify**

```bash
pnpm check
pnpm build
pnpm test
```

All must pass.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore(tree-v2 TV6): delete old FamilyTree.tsx — replaced by FamilyTreeScroll"
```

---

## Phase TV7 — Polish + push

### Task 9: Final smoke + memory + push

**Files:** none

- [ ] **Step 1: Quality gates**

```bash
cd /home/mininja/Github/family
pnpm test
pnpm check
pnpm check:no-cjk
pnpm build
```

All must pass.

- [ ] **Step 2: Update memory**

Append to `/home/mininja/.claude/projects/-home-mininja/memory/project_family_astro.md` — under the most recent state heading:

```markdown
### Tree v2 session (2026-05-08) — what was built

`/family-tree` replaced — old pan/zoom canvas (`FamilyTree.tsx`, 545 LOC) deleted; new vertical-scroll calligraphy tree (`FamilyTreeScroll.tsx` + sub-folder).

Components at `src/components/react/family-tree-scroll/`:
- `layout.ts` — pure function `members → rows[]` with couple units + parent links + tests
- `FounderCard` — gen 1 large card với lotus seal + role + dates + birthplace
- `MemberTile` — gen 2+ small tile (round 64px portrait + Lora name + dates)
- `CoupleUnit` — wraps anchor + spouse with ♡ between
- `Connectors` — SVG layer measures DOM positions via data-unit-id, draws cubic bezier paths gold-2 → gold-3 with deterministic jitter; ResizeObserver keeps positions accurate on flex-wrap
- `HoverPanel` — desktop-only side câu đối motion slide-from-right showing role + sinh/mất + quê + cha/mẹ/vợ/con count

Page: `family-tree.astro` adds u-paper-texture + side mây triện gold-3 striped borders.

Mobile: single-column stack, narrower tiles, no hover panel — tap → modal directly.

Hover state managed at root; click → existing `$modalMember` nanostore (no new modal).

Effort: ~2.5 dev-days. ~9 commits.
```

- [ ] **Step 3: Final marker commit + push**

```bash
git commit --allow-empty -m "chore(tree-v2): Phase 1 complete — vertical-scroll calligraphy tree"
git push
```

---

## Self-review

- [ ] `/family-tree` renders founder centered top, descendants flowing down
- [ ] Watercolor connectors visible (curved bezier, gold gradient)
- [ ] Hover desktop → side panel appears within 250ms
- [ ] Click any tile → MemberModal opens
- [ ] Mobile (≤768px): single-column stack, no horizontal scroll
- [ ] Generation dividers visible between rows
- [ ] Couple units render side-by-side với ♡
- [ ] Old `FamilyTree.tsx` deleted, no orphan imports
- [ ] `pnpm test` passes (5 new layout tests)
- [ ] `pnpm check` 0 errors, `pnpm check:no-cjk` clean
- [ ] No CJK chars in any new source

---

**End of plan.**
