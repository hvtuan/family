import { useRef, useState } from "react";
import type { ClientMember } from "@/lib/members-client";
import { computeLayout } from "./family-tree-scroll/layout";
import FounderCard from "./family-tree-scroll/FounderCard";
import CoupleUnit from "./family-tree-scroll/CoupleUnit";
import Connectors from "./family-tree-scroll/Connectors";
import HoverPanel from "./family-tree-scroll/HoverPanel";

interface Props { members: ClientMember[]; }

export default function FamilyTreeScroll({ members }: Props) {
  const rows = computeLayout(members);
  const [hovered, setHovered] = useState<ClientMember | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  if (rows.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-line bg-cream/40 p-12 text-center">
        <p className="text-base text-ink-3 m-0">Chưa có dữ liệu thành viên.</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative" data-tree-scroll>
      <Connectors rows={rows} containerRef={containerRef} />
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
              <div className="flex flex-wrap justify-center gap-x-2 sm:gap-x-4 gap-y-6">
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
      <HoverPanel member={hovered} members={members} />
    </div>
  );
}
