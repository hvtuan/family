import MemberTile from "./MemberTile";
import type { ClientMember } from "@/lib/members-client";

interface Props {
  anchor: ClientMember;
  spouse: ClientMember | null;
  onHover?: (m: ClientMember | null) => void;
}

/**
 * Anchor + optional spouse. Spouse pairs are placed side-by-side; the
 * connector logic in Connectors.tsx handles linking the couple's
 * descendants from the midpoint between the two tiles via the unit's
 * data-unit-id wrapper. No visible glyph between spouses — keeps the
 * layout clean per modern Western tree templates.
 */
export default function CoupleUnit({ anchor, spouse, onHover }: Props) {
  if (!spouse) {
    return (
      <div data-unit-id={anchor.id} className="flex justify-center">
        <MemberTile member={anchor} onHover={onHover} />
      </div>
    );
  }
  return (
    <div data-unit-id={anchor.id} className="flex items-start gap-1">
      <MemberTile member={anchor} onHover={onHover} />
      <MemberTile member={spouse} onHover={onHover} />
    </div>
  );
}
