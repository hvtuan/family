import { $modalMember } from "@/stores/ui";
import type { ClientMember } from "@/lib/members-client";

interface Props { member: ClientMember; }

const FOUNDER_BLOB = "rgba(220, 190, 127, 0.65)"; // warm gold halo

/**
 * Founder card — same watercolor portrait language as MemberTile but
 * larger, with an extra year line. Acts as the visual anchor at the top
 * of the tree without ornate framing.
 */
export default function FounderCard({ member }: Props) {
  const initial = member.name.trim().slice(0, 1);
  const b = member.born ? new Date(member.born).getFullYear() : null;
  const d = member.died ? new Date(member.died).getFullYear() : null;
  const dates = b && d ? `${b} — ${d}` : b ? `${b} — nay` : "";

  return (
    <button
      type="button"
      onClick={() => $modalMember.set(member.id)}
      className="group block w-[180px] sm:w-[200px] text-center px-3 py-4 rounded-md hover:bg-cream/40 transition-colors"
      aria-label={`Xem chi tiết ${member.name}`}
    >
      <span className="relative inline-block">
        <span
          aria-hidden="true"
          className="absolute -inset-3 rounded-full blur-lg"
          style={{ background: FOUNDER_BLOB }}
        />
        <span className="relative block size-[110px] sm:size-[120px] overflow-hidden rounded-full border-2 border-cream shadow-paper-2 group-hover:scale-[1.03] transition-transform">
          {member.photo ? (
            <img
              src={member.photo}
              alt=""
              className="w-full h-full object-cover"
              loading="eager"
            />
          ) : (
            <span className="flex w-full h-full items-center justify-center bg-cream text-gold-2/55 font-display italic text-4xl">
              {initial}
            </span>
          )}
        </span>
      </span>

      <span className="block mt-4 font-semibold text-ink text-base leading-tight">
        {member.name}
      </span>
      {member.role && (
        <span className="block mt-1 text-xs text-ink-3 leading-tight">
          {member.role}{member.isFamilyHead ? " · Tộc trưởng" : ""}
        </span>
      )}
      {dates && (
        <span className="block mt-1 text-[10px] text-ink-3 tabular-nums tracking-wide">
          {dates}
        </span>
      )}
    </button>
  );
}
