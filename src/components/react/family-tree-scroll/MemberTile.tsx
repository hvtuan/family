import { $modalMember } from "@/stores/ui";
import type { ClientMember } from "@/lib/members-client";

interface Props {
  member: ClientMember;
  onHover?: (m: ClientMember | null) => void;
}

/**
 * Vertical "tablet" tile (bài vị từ đường aesthetic). Replaces the earlier
 * round portrait + name pattern. Each tile has:
 *   - Arc top (asymmetric border-radius) suggesting a shrine plaque
 *   - Corner ornaments (gold L-shapes via SVG)
 *   - Sepia portrait inside the upper section
 *   - Name + dates in a stacked lower section separated by a gold rule
 *   - Hover: subtle vermilion seal stamp surfaces top-right
 */
export default function MemberTile({ member, onHover }: Props) {
  const initial = member.name.trim().slice(0, 1);
  const b = member.born ? new Date(member.born).getFullYear() : null;
  const d = member.died ? new Date(member.died).getFullYear() : null;

  return (
    <button
      type="button"
      onClick={() => $modalMember.set(member.id)}
      onMouseEnter={() => onHover?.(member)}
      onMouseLeave={() => onHover?.(null)}
      onFocus={() => onHover?.(member)}
      onBlur={() => onHover?.(null)}
      className="group relative block w-[100px] sm:w-[112px] text-center"
      aria-label={`Xem chi tiết ${member.name}`}
    >
      <span
        className="relative block overflow-hidden bg-cream/60 border border-gold-2/40 group-hover:border-gold-2/70 group-hover:shadow-[0_10px_24px_-12px_rgba(120,80,40,0.35)] transition-all"
        style={{
          borderTopLeftRadius: "20px 28px",
          borderTopRightRadius: "20px 28px",
          borderBottomLeftRadius: "4px",
          borderBottomRightRadius: "4px",
        }}
      >
        {/* Corner ornaments — gold L-brackets at the top corners */}
        <svg
          aria-hidden="true"
          className="absolute left-1 top-2 text-gold-2/55"
          width="10" height="10" viewBox="0 0 10 10"
        >
          <path d="M0 8 L0 2 Q0 0 2 0 L8 0" stroke="currentColor" strokeWidth="1" fill="none" />
        </svg>
        <svg
          aria-hidden="true"
          className="absolute right-1 top-2 text-gold-2/55"
          width="10" height="10" viewBox="0 0 10 10"
        >
          <path d="M10 8 L10 2 Q10 0 8 0 L2 0" stroke="currentColor" strokeWidth="1" fill="none" />
        </svg>

        {/* Vermilion seal accent on hover */}
        <span
          aria-hidden="true"
          className="absolute right-1.5 top-1 text-vermilion text-[14px] opacity-0 group-hover:opacity-70 transition-opacity"
          style={{ fontFamily: "var(--font-script)" }}
        >
          ⊛
        </span>

        {/* Portrait */}
        <span
          className="block w-full overflow-hidden"
          style={{ aspectRatio: "4 / 5", filter: "sepia(0.18) saturate(0.9)" }}
        >
          {member.photo ? (
            <img
              src={member.photo}
              alt=""
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <span className="flex w-full h-full items-center justify-center bg-paper-2/40 text-gold-2/50 font-display italic text-2xl">
              {initial}
            </span>
          )}
        </span>

        {/* Gold rule */}
        <span aria-hidden="true" className="block h-px bg-gold-2/40" />

        {/* Name + dates */}
        <span className="block px-1.5 py-2 leading-tight">
          <span className="block font-display italic text-ink text-[12px] sm:text-[13px] truncate">
            {member.name}
          </span>
          {(b || d) && (
            <span className="block text-[9px] text-ink-3 tabular-nums mt-0.5">
              {b ?? "—"}<span className="opacity-50">–</span>{d ?? "nay"}
            </span>
          )}
        </span>
      </span>

      {member.isFamilyHead && (
        <span
          aria-hidden="true"
          className="absolute -top-1.5 -right-1.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-vermilion text-cream text-[9px] font-semibold shadow-paper-1"
          title="Tộc trưởng"
        >
          ⊛
        </span>
      )}
    </button>
  );
}
