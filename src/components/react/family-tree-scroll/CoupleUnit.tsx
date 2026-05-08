import MemberTile from "./MemberTile";
import type { ClientMember } from "@/lib/members-client";

interface Props {
  anchor: ClientMember;
  spouse: ClientMember | null;
  onHover?: (m: ClientMember | null) => void;
}

/**
 * A unit grouping anchor + optional spouse. When spouse exists, an
 * ornate medallion (interlocking rings on a thin gold rule) sits between
 * them — replaces the placeholder ♡ heart with a culturally-grounded
 * marriage symbol.
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
    <div data-unit-id={anchor.id} className="flex items-center gap-1 px-2">
      <MemberTile member={anchor} onHover={onHover} />
      <CoupleMedallion />
      <MemberTile member={spouse} onHover={onHover} />
    </div>
  );
}

/**
 * Two interlocking circles — minimalist marriage motif. Replaces the
 * placeholder ♡ heart with two linked rings on a thin gold rule.
 */
function CoupleMedallion() {
  return (
    <span aria-hidden="true" className="self-start mt-12 sm:mt-14 -mx-1">
      <svg width="22" height="22" viewBox="0 0 22 22" className="text-gold-2/70">
        <g stroke="currentColor" strokeWidth="1.1" fill="none">
          <circle cx="8" cy="11" r="4.6" />
          <circle cx="14" cy="11" r="4.6" />
          {/* Faint connecting glyph */}
          <line x1="0" y1="11" x2="3" y2="11" opacity="0.5" />
          <line x1="19" y1="11" x2="22" y2="11" opacity="0.5" />
        </g>
      </svg>
    </span>
  );
}
