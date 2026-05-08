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
