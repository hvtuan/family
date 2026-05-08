import { $modalMember } from "@/stores/ui";
import type { ClientMember } from "@/lib/members-client";

interface Props {
  member: ClientMember;
  onHover?: (m: ClientMember | null) => void;
}

export default function MemberTile({ member, onHover }: Props) {
  const initial = member.name.trim().slice(0, 1);
  const b = member.born ? new Date(member.born).getFullYear() : null;
  const d = member.died ? new Date(member.died).getFullYear() : null;
  const dates = b && d ? `${b}–${d}` : b ? `'${String(b).slice(2)}–nay` : "";

  return (
    <button
      type="button"
      onClick={() => $modalMember.set(member.id)}
      onMouseEnter={() => onHover?.(member)}
      onMouseLeave={() => onHover?.(null)}
      onFocus={() => onHover?.(member)}
      onBlur={() => onHover?.(null)}
      className="group flex flex-col items-center gap-2 w-[120px] py-2 px-1 rounded-md hover:bg-cream/60 transition-colors text-center"
      aria-label={`Xem chi tiết ${member.name}`}
    >
      <span
        className="block size-16 overflow-hidden rounded-full border border-gold-2/40 group-hover:border-vermilion/60 transition-colors"
        style={{ filter: "sepia(0.18) saturate(0.9)" }}
      >
        {member.photo ? (
          <img src={member.photo} alt="" className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <span className="flex w-full h-full items-center justify-center bg-paper-2/40 text-gold-2/60 font-display italic text-xl">
            {initial}
          </span>
        )}
      </span>
      <span className="font-display italic text-ink text-sm leading-tight m-0 truncate max-w-full">
        {member.name}
      </span>
      {dates && (
        <span className="text-[10px] text-ink-3 tabular-nums m-0">{dates}</span>
      )}
    </button>
  );
}
