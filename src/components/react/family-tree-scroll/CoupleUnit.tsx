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
