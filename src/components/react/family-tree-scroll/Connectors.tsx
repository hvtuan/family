import { useEffect, useState } from "react";
import type { LayoutRow } from "./layout";

interface Props {
  rows: LayoutRow[];
  containerRef: React.RefObject<HTMLDivElement | null>;
}

interface PathSpec { d: string; }

/**
 * Orthogonal flow-chart connectors — modern minimal style.
 *
 * For each parent unit with children:
 *   1. Vertical drop from parent center-bottom to a horizontal "trunk"
 *      placed midway between gen rows.
 *   2. Horizontal trunk spanning all that parent's children's x positions.
 *   3. Short verticals from trunk up to each child center-top.
 *
 * Stroke: 1px solid muted ink. No curves, no jitter — clean and
 * scannable, matching the Western family-tree template aesthetic.
 *
 * DOM measure approach: read [data-unit-id] elements, recompute on
 * resize via ResizeObserver to handle flex-wrap.
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
          if (u.childIds.length === 0) continue;
          const parentPos = positions.get(u.anchor.id);
          if (!parentPos) continue;

          // Resolve all child positions
          const childPositions: Array<{ x: number; yTop: number }> = [];
          for (const childMemberId of u.childIds) {
            const childUnitId = findUnitIdForMember(rows, row.gen + 1, childMemberId);
            if (!childUnitId) continue;
            const childPos = positions.get(childUnitId);
            if (childPos) childPositions.push(childPos);
          }
          if (childPositions.length === 0) continue;

          // Trunk Y = halfway between parent bottom and minimum child top
          const minChildTop = Math.min(...childPositions.map((p) => p.yTop));
          const trunkY = parentPos.yBottom + (minChildTop - parentPos.yBottom) * 0.55;

          // Path 1: parent vertical drop to trunk
          out.push({ d: `M ${parentPos.x} ${parentPos.yBottom} L ${parentPos.x} ${trunkY}` });

          if (childPositions.length === 1) {
            // Single child: skip horizontal trunk, just connect direct
            const child = childPositions[0];
            out.push({ d: `M ${parentPos.x} ${trunkY} L ${child.x} ${trunkY} L ${child.x} ${child.yTop}` });
          } else {
            // Horizontal trunk spanning all children x-range
            const minX = Math.min(parentPos.x, ...childPositions.map((p) => p.x));
            const maxX = Math.max(parentPos.x, ...childPositions.map((p) => p.x));
            out.push({ d: `M ${minX} ${trunkY} L ${maxX} ${trunkY}` });
            // Verticals from trunk to each child
            for (const child of childPositions) {
              out.push({ d: `M ${child.x} ${trunkY} L ${child.x} ${child.yTop}` });
            }
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
      {paths.map((p, i) => (
        <path
          key={i}
          d={p.d}
          stroke="rgba(60, 50, 35, 0.5)"
          strokeWidth={1}
          fill="none"
          strokeLinecap="round"
          shapeRendering="geometricPrecision"
        />
      ))}
    </svg>
  );
}

function findUnitIdForMember(rows: LayoutRow[], gen: number, memberId: string): string | null {
  const row = rows.find((r) => r.gen === gen);
  if (!row) return null;
  for (const u of row.units) {
    if (u.anchor.id === memberId || u.spouse?.id === memberId) return u.anchor.id;
  }
  return null;
}
