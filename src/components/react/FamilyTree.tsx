import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { $modalMember } from "@/stores/ui";
import type { ClientMember } from "@/lib/members-client";
import "./FamilyTree.css";

type Props = { members: ClientMember[] };

const CARD_W = 200;
const CARD_H = 84;
const COUPLE_INNER_GAP = 32;
const COUPLE_W = CARD_W * 2 + COUPLE_INNER_GAP;
const ROW_HEIGHT = 220;
const UNIT_GAP = 60;
const MIN_SCALE = 0.3;
const MAX_SCALE = 2.0;
const DRAG_THRESHOLD = 5;

type Pos = { x: number; y: number; w: number; h: number };

type LayoutResult = {
  positions: Map<string, Pos>;
  couples: { leftId: string; rightId: string; y: number; cx: number }[];
  parentLinks: { from: { x: number; y: number }; to: { x: number; y: number } }[];
  bounds: { width: number; height: number };
};

function buildLayout(members: ClientMember[]): LayoutResult {
  const byId = new Map(members.map((m) => [m.id, m] as const));

  // Group by gen
  const byGen = new Map<number, ClientMember[]>();
  for (const m of members) {
    if (!byGen.has(m.gen)) byGen.set(m.gen, []);
    byGen.get(m.gen)!.push(m);
  }
  for (const list of byGen.values()) {
    list.sort((a, b) => (a.birthOrder ?? 99) - (b.birthOrder ?? 99));
  }

  // Build "family units": couple or single
  // unitId is the anchor member's id; unitMembers maps unitId → [anchor, spouse?]
  const unitOf = new Map<string, string>();
  const unitMembers = new Map<string, string[]>();
  const unitGen = new Map<string, number>();

  for (const list of byGen.values()) {
    const seen = new Set<string>();
    for (const m of list) {
      if (seen.has(m.id)) continue;
      const partner =
        m.spouse && list.find((x) => x.id === m.spouse) && !seen.has(m.spouse)
          ? byId.get(m.spouse)
          : undefined;
      const unitId = m.id;
      const slot = partner ? [m.id, partner.id] : [m.id];
      unitMembers.set(unitId, slot);
      unitGen.set(unitId, m.gen);
      for (const id of slot) {
        unitOf.set(id, unitId);
        seen.add(id);
      }
    }
  }

  // Parent-child unit relationships
  const parentUnit = new Map<string, string>(); // childMemberId → parent unitId
  for (const m of members) {
    const pid = m.father ?? m.mother;
    if (pid && unitOf.has(pid)) parentUnit.set(m.id, unitOf.get(pid)!);
  }

  const childrenUnits = new Map<string, string[]>();
  for (const [memberId, parentU] of parentUnit) {
    const childU = unitOf.get(memberId)!;
    const arr = childrenUnits.get(parentU) ?? [];
    if (!arr.includes(childU)) arr.push(childU);
    childrenUnits.set(parentU, arr);
  }

  const widthOf = (u: string) =>
    (unitMembers.get(u)?.length ?? 1) === 2 ? COUPLE_W : CARD_W;

  // Subtree width memo
  const subWidth = new Map<string, number>();
  function calcSubWidth(u: string): number {
    if (subWidth.has(u)) return subWidth.get(u)!;
    const kids = childrenUnits.get(u) ?? [];
    if (kids.length === 0) {
      subWidth.set(u, widthOf(u));
      return widthOf(u);
    }
    let w = 0;
    kids.forEach((c, i) => {
      w += calcSubWidth(c) + (i > 0 ? UNIT_GAP : 0);
    });
    const own = widthOf(u);
    const result = Math.max(own, w);
    subWidth.set(u, result);
    return result;
  }

  // Roots = units whose anchor has no parent in members
  const allUnits = Array.from(unitMembers.keys());
  const roots = allUnits.filter((u) => !parentUnit.has(unitMembers.get(u)![0]));
  // Sort roots by their members' birthOrder (or id) for stability
  roots.sort((a, b) => {
    const ma = byId.get(unitMembers.get(a)![0])!;
    const mb = byId.get(unitMembers.get(b)![0])!;
    return (ma.birthOrder ?? 99) - (mb.birthOrder ?? 99);
  });

  // Lay out: for each root, recursively place
  const unitLeft = new Map<string, number>();
  function place(u: string, leftX: number) {
    const tw = calcSubWidth(u);
    const ow = widthOf(u);
    const own_left = leftX + (tw - ow) / 2;
    unitLeft.set(u, own_left);

    const kids = childrenUnits.get(u) ?? [];
    let cursor = leftX;
    for (const c of kids) {
      const cw = calcSubWidth(c);
      place(c, cursor);
      cursor += cw + UNIT_GAP;
    }
  }

  let rootCursor = 0;
  for (const r of roots) {
    place(r, rootCursor);
    rootCursor += calcSubWidth(r) + UNIT_GAP * 2;
  }

  // Compute member positions
  const positions = new Map<string, Pos>();
  const couples: LayoutResult["couples"] = [];

  for (const [u, slot] of unitMembers) {
    const left = unitLeft.get(u)!;
    const gen = unitGen.get(u)!;
    const y = (gen - 1) * ROW_HEIGHT;
    slot.forEach((mid, idx) => {
      positions.set(mid, {
        x: left + idx * (CARD_W + COUPLE_INNER_GAP),
        y,
        w: CARD_W,
        h: CARD_H,
      });
    });
    if (slot.length === 2) {
      couples.push({
        leftId: slot[0],
        rightId: slot[1],
        y: y + CARD_H / 2,
        cx: left + CARD_W + COUPLE_INNER_GAP / 2,
      });
    }
  }

  // Parent-child connectors
  const parentLinks: LayoutResult["parentLinks"] = [];
  for (const [childMember, parentU] of parentUnit) {
    const childPos = positions.get(childMember)!;
    const slot = unitMembers.get(parentU)!;
    const parentLeft = unitLeft.get(parentU)!;
    const parentGen = unitGen.get(parentU)!;
    const parentMidX =
      parentLeft +
      (slot.length === 2 ? COUPLE_W / 2 : CARD_W / 2);
    const parentBottomY = (parentGen - 1) * ROW_HEIGHT + CARD_H;
    parentLinks.push({
      from: { x: parentMidX, y: parentBottomY },
      to: { x: childPos.x + CARD_W / 2, y: childPos.y },
    });
  }

  // Bounds
  let maxX = 0;
  let maxY = 0;
  for (const p of positions.values()) {
    maxX = Math.max(maxX, p.x + p.w);
    maxY = Math.max(maxY, p.y + p.h);
  }

  return {
    positions,
    couples,
    parentLinks,
    bounds: { width: maxX, height: maxY },
  };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

export default function FamilyTree({ members }: Props) {
  const layout = useMemo(() => buildLayout(members), [members]);
  const padding = 40;
  const stageWidth = layout.bounds.width + padding * 2;
  const stageHeight = layout.bounds.height + padding * 2;

  const containerRef = useRef<HTMLDivElement>(null);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const [scale, setScale] = useState(1);
  const [zoomAnnouncement, setZoomAnnouncement] = useState(`100%`);

  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const lastDistRef = useRef<number | null>(null);
  const dragMoveRef = useRef<number>(0);
  const suppressClickRef = useRef<boolean>(false);

  const fitToScreen = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const cw = el.clientWidth;
    const ch = el.clientHeight;
    if (!cw || !ch) return;
    const s = clamp(
      Math.min(cw / stageWidth, ch / stageHeight) * 0.96,
      MIN_SCALE,
      MAX_SCALE,
    );
    setScale(s);
    setTx((cw - stageWidth * s) / 2);
    setTy((ch - stageHeight * s) / 2);
    setZoomAnnouncement(`${Math.round(s * 100)}%`);
  }, [stageWidth, stageHeight]);

  // Fit on mount + on resize
  useEffect(() => {
    fitToScreen();
    const onResize = () => fitToScreen();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [fitToScreen]);

  const reset = useCallback(() => {
    setScale(1);
    const el = containerRef.current;
    if (el) {
      setTx((el.clientWidth - stageWidth) / 2);
      setTy(40);
    } else {
      setTx(0);
      setTy(0);
    }
    setZoomAnnouncement(`100%`);
  }, [stageWidth]);

  const zoomBy = useCallback((factor: number, originX?: number, originY?: number) => {
    setScale((s) => {
      const next = clamp(s * factor, MIN_SCALE, MAX_SCALE);
      if (originX !== undefined && originY !== undefined) {
        // keep origin point stationary while zooming
        const ratio = next / s;
        setTx((tx) => originX - ratio * (originX - tx));
        setTy((ty) => originY - ratio * (originY - ty));
      }
      setZoomAnnouncement(`${Math.round(next * 100)}%`);
      return next;
    });
  }, []);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.target instanceof Element && e.target.closest("button, a")) {
      // Let buttons receive their own pointer events (fit/zoom + cards).
      // We still track for pan/zoom on background.
    }
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    dragMoveRef.current = 0;
    suppressClickRef.current = false;
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const pointers = pointersRef.current;
    if (!pointers.has(e.pointerId)) return;
    const prev = pointers.get(e.pointerId)!;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pointers.size === 1) {
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      setTx((v) => v + dx);
      setTy((v) => v + dy);
      dragMoveRef.current += Math.hypot(dx, dy);
      if (dragMoveRef.current > DRAG_THRESHOLD) suppressClickRef.current = true;
    } else if (pointers.size === 2) {
      const arr = Array.from(pointers.values());
      const newDist = Math.hypot(arr[0].x - arr[1].x, arr[0].y - arr[1].y);
      const midX = (arr[0].x + arr[1].x) / 2;
      const midY = (arr[0].y + arr[1].y) / 2;
      const containerRect = containerRef.current?.getBoundingClientRect();
      const localX = midX - (containerRect?.left ?? 0);
      const localY = midY - (containerRect?.top ?? 0);
      if (lastDistRef.current && lastDistRef.current > 0) {
        zoomBy(newDist / lastDistRef.current, localX, localY);
      }
      lastDistRef.current = newDist;
      suppressClickRef.current = true;
    }
  };

  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) lastDistRef.current = null;
  };

  const onWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (!e.ctrlKey && !e.metaKey) return; // only zoom with modifier; otherwise let scroll
    e.preventDefault();
    const rect = containerRef.current?.getBoundingClientRect();
    const x = e.clientX - (rect?.left ?? 0);
    const y = e.clientY - (rect?.top ?? 0);
    zoomBy(e.deltaY < 0 ? 1.1 : 1 / 1.1, x, y);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const STEP = 60;
    if (e.key === "ArrowLeft") {
      setTx((v) => v + STEP);
      e.preventDefault();
    } else if (e.key === "ArrowRight") {
      setTx((v) => v - STEP);
      e.preventDefault();
    } else if (e.key === "ArrowUp") {
      setTy((v) => v + STEP);
      e.preventDefault();
    } else if (e.key === "ArrowDown") {
      setTy((v) => v - STEP);
      e.preventDefault();
    } else if (e.key === "+" || e.key === "=") {
      zoomBy(1.15);
      e.preventDefault();
    } else if (e.key === "-" || e.key === "_") {
      zoomBy(1 / 1.15);
      e.preventDefault();
    } else if (e.key === "0") {
      reset();
      e.preventDefault();
    } else if (e.key.toLowerCase() === "f") {
      fitToScreen();
      e.preventDefault();
    }
  };

  const onCardClick = (id: string, e: React.MouseEvent) => {
    if (suppressClickRef.current) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    $modalMember.set(id);
  };

  const memberById = useMemo(
    () => new Map(members.map((m) => [m.id, m] as const)),
    [members],
  );

  return (
    <div className="ft-wrap">
      <div className="ft-toolbar" role="toolbar" aria-label="Điều khiển cây gia phả">
        <button type="button" onClick={() => zoomBy(1.2)} aria-label="Phóng to">
          +
        </button>
        <button type="button" onClick={() => zoomBy(1 / 1.2)} aria-label="Thu nhỏ">
          −
        </button>
        <button type="button" onClick={fitToScreen} aria-label="Vừa khung">
          Vừa khung
        </button>
        <button type="button" onClick={reset} aria-label="Đặt lại 1:1">
          1:1
        </button>
        <span className="ft-zoom-readout" aria-live="polite">
          {zoomAnnouncement}
        </span>
      </div>

      <p className="ft-hint">
        <span>Kéo để di chuyển • Scroll + Ctrl/Cmd để phóng to</span>
        <span lang="en" className="ft-hint-en">
          Drag to pan · Pinch on touch · Ctrl/Cmd + scroll to zoom
        </span>
      </p>

      <div
        className="ft-stage"
        ref={containerRef}
        role="tree"
        aria-label="Cây gia phả họ Nguyễn"
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
        onKeyDown={onKeyDown}
      >
        <div
          className="ft-world"
          style={{
            transform: `translate(${tx}px, ${ty}px) scale(${scale})`,
            width: stageWidth,
            height: stageHeight,
          }}
        >
          <svg
            className="ft-svg"
            width={stageWidth}
            height={stageHeight}
            viewBox={`0 0 ${stageWidth} ${stageHeight}`}
            aria-hidden="true"
          >
            {layout.couples.map((c) => {
              const lx = (layout.positions.get(c.leftId)?.x ?? 0) + CARD_W;
              const rx = layout.positions.get(c.rightId)?.x ?? 0;
              return (
                <line
                  key={`couple-${c.leftId}`}
                  x1={lx + padding}
                  y1={c.y + padding}
                  x2={rx + padding}
                  y2={c.y + padding}
                  stroke="#8b2a1f"
                  strokeWidth="2"
                  strokeDasharray="4 4"
                />
              );
            })}
            {layout.parentLinks.map((link, i) => {
              const fx = link.from.x + padding;
              const fy = link.from.y + padding;
              const tx2 = link.to.x + padding;
              const ty2 = link.to.y + padding;
              const midY = fy + (ty2 - fy) / 2;
              return (
                <path
                  key={`link-${i}`}
                  d={`M ${fx} ${fy} L ${fx} ${midY} L ${tx2} ${midY} L ${tx2} ${ty2}`}
                  fill="none"
                  stroke="rgba(26, 18, 10, 0.35)"
                  strokeWidth="1.5"
                />
              );
            })}
          </svg>

          {/* Generation labels */}
          {Array.from(
            new Set(Array.from(layout.positions.values()).map((p) => p.y)),
          )
            .sort((a, b) => a - b)
            .map((y, idx) => (
              <div
                key={`row-${y}`}
                className="ft-row-label"
                style={{
                  left: padding,
                  top: y + padding + CARD_H / 2 - 18,
                }}
              >
                Đời {idx + 1}
              </div>
            ))}

          {/* Member cards */}
          {Array.from(layout.positions.entries()).map(([id, p]) => {
            const m = memberById.get(id)!;
            const yearB = m.born?.slice(0, 4);
            const yearD = m.died?.slice(0, 4);
            return (
              <button
                key={id}
                type="button"
                className="ft-card"
                role="treeitem"
                aria-level={m.gen}
                aria-label={`${m.name}, đời thứ ${m.gen}`}
                style={{
                  left: p.x + padding,
                  top: p.y + padding,
                  width: p.w,
                  height: p.h,
                }}
                onClick={(e) => onCardClick(id, e)}
              >
                <span className="ft-card-mono" aria-hidden="true">
                  {m.name.split(" ").slice(-1)[0]?.charAt(0) ?? "?"}
                </span>
                <span className="ft-card-text">
                  <span className="ft-card-name">{m.name}</span>
                  <span className="ft-card-role">{m.role}</span>
                  <span className="ft-card-years">
                    {yearB ?? ""}
                    {yearD ? ` – ${yearD}` : yearB ? " – nay" : ""}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
