import { useEffect, useState } from "react";
import type { LayoutRow } from "./layout";

interface Props {
  rows: LayoutRow[];
  containerRef: React.RefObject<HTMLDivElement | null>;
}

interface PathSpec { d: string; }

/**
 * Watercolor brush connectors. Each parent→child relationship is drawn
 * as 3 stacked cubic bezier paths with varying stroke widths and
 * opacities, simulating a sumi-e brush stroke (broad base, tapered toward
 * the leaf). End points get small ink dots to soften the joints.
 *
 * DOM-measure approach: read [data-unit-id] elements after mount, recompute
 * on resize via ResizeObserver so flex-wrap on viewport change stays
 * accurate.
 */
export default function Connectors({ rows, containerRef }: Props) {
  const [paths, setPaths] = useState<PathSpec[]>([]);
  const [dots, setDots] = useState<Array<{ x: number; y: number }>>([]);
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
      const dotOut: Array<{ x: number; y: number }> = [];
      for (const row of rows) {
        for (const u of row.units) {
          const parentPos = positions.get(u.anchor.id);
          if (!parentPos) continue;
          if (u.childIds.length > 0) {
            dotOut.push({ x: parentPos.x, y: parentPos.yBottom });
          }
          for (const childMemberId of u.childIds) {
            const childUnitId = findUnitIdForMember(rows, row.gen + 1, childMemberId);
            if (!childUnitId) continue;
            const childPos = positions.get(childUnitId);
            if (!childPos) continue;
            out.push({ d: bezierPath(parentPos.x, parentPos.yBottom, childPos.x, childPos.yTop) });
            dotOut.push({ x: childPos.x, y: childPos.yTop });
          }
        }
      }
      setPaths(out);
      setDots(dotOut);
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
        <linearGradient id="tree-brush-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-gold-2)" stopOpacity="0.95" />
          <stop offset="100%" stopColor="var(--color-gold-3)" stopOpacity="0.55" />
        </linearGradient>
        <linearGradient id="tree-brush-ink" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--color-gold-2)" stopOpacity="0.45" />
          <stop offset="100%" stopColor="var(--color-ink)" stopOpacity="0.18" />
        </linearGradient>
      </defs>

      {/* Wide soft underlay — ink wash */}
      {paths.map((p, i) => (
        <path
          key={`u-${i}`}
          d={p.d}
          stroke="url(#tree-brush-ink)"
          strokeWidth={5}
          fill="none"
          strokeLinecap="round"
          opacity={0.35}
        />
      ))}
      {/* Mid layer — brush body */}
      {paths.map((p, i) => (
        <path
          key={`m-${i}`}
          d={p.d}
          stroke="url(#tree-brush-gold)"
          strokeWidth={2.2}
          fill="none"
          strokeLinecap="round"
          opacity={0.8}
        />
      ))}
      {/* Top hair stroke — crisp accent */}
      {paths.map((p, i) => (
        <path
          key={`t-${i}`}
          d={p.d}
          stroke="var(--color-gold-2)"
          strokeWidth={0.7}
          fill="none"
          strokeLinecap="round"
          opacity={0.65}
        />
      ))}

      {/* Ink dots at junction points (soft brush starts/ends) */}
      {dots.map((d, i) => (
        <circle
          key={`d-${i}`}
          cx={d.x}
          cy={d.y}
          r={2.4}
          fill="var(--color-gold-2)"
          opacity={0.55}
        />
      ))}
    </svg>
  );
}

function bezierPath(x1: number, y1: number, x2: number, y2: number): string {
  // Cubic bezier — gentler curve than before (control points pulled
  // closer to vertical to avoid balloon shapes), with deterministic
  // jitter for hand-drawn feel.
  const dy = y2 - y1;
  const midY = y1 + dy * 0.5;
  const jitter = ((x1 + x2) % 7) - 3;
  const cp1x = x1 + jitter * 0.6;
  const cp1y = y1 + dy * 0.45;
  const cp2x = x2 - jitter * 0.6;
  const cp2y = midY + dy * 0.05;
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
