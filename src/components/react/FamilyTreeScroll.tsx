import { useRef, useState } from "react";
import type { ClientMember } from "@/lib/members-client";
import { computeLayout } from "./family-tree-scroll/layout";
import FounderCard from "./family-tree-scroll/FounderCard";
import CoupleUnit from "./family-tree-scroll/CoupleUnit";
import Connectors from "./family-tree-scroll/Connectors";
import HoverPanel from "./family-tree-scroll/HoverPanel";
import GenerationBanner from "./family-tree-scroll/GenerationBanner";
import Frontispiece from "./family-tree-scroll/Frontispiece";
import MayTrien from "./family-tree-scroll/MayTrien";

interface SiteInfo {
  surname: string;
  hometown: string;
  motto: string;
  established: number | null;
}

interface Props {
  members: ClientMember[];
  site: SiteInfo;
  generationsCount: number;
}

export default function FamilyTreeScroll({ members, site, generationsCount }: Props) {
  const rows = computeLayout(members);
  const [hovered, setHovered] = useState<ClientMember | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const publicationYear = new Date().getFullYear();

  return (
    <div className="relative">
      {/* Mây triện cloud-scroll borders on left/right (desktop only) */}
      <MayTrien side="left" />
      <MayTrien side="right" />

      {/* Frontispiece header */}
      <Frontispiece
        surname={site.surname}
        hometown={site.hometown}
        motto={site.motto}
        established={site.established}
        publicationYear={publicationYear}
        generationsCount={generationsCount}
        membersCount={members.length}
      />

      {rows.length === 0 ? (
        <div className="rounded-md border border-dashed border-line bg-cream/40 p-12 text-center max-w-prose mx-auto">
          <p className="text-base text-ink-3 m-0">Chưa có dữ liệu thành viên.</p>
        </div>
      ) : (
        <div ref={containerRef} className="relative" data-tree-scroll>
          <Connectors rows={rows} containerRef={containerRef} />

          {rows.map((row, idx) => {
            const isFounderRow =
              idx === 0 && row.units.length === 1 && !row.units[0].spouse;
            return (
              <div key={row.gen} className="relative">
                {idx > 0 && <GenerationBanner gen={row.gen} />}

                {isFounderRow ? (
                  <div className="flex justify-center">
                    <FounderCard member={row.units[0].anchor} />
                  </div>
                ) : (
                  <div className="flex flex-wrap justify-center gap-x-3 sm:gap-x-5 gap-y-8">
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
      )}

      <HoverPanel member={hovered} members={members} />
    </div>
  );
}
