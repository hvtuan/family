import { $modalMember } from "@/stores/ui";
import type { ClientMember } from "@/lib/members-client";

interface Props {
  member: ClientMember;
  onHover?: (m: ClientMember | null) => void;
}

/**
 * Watercolor portrait tile — round photo with a soft color wash blob
 * behind it, name + role label below. Inspired by modern minimal family
 * tree templates. The blob color rotates deterministically by member id
 * so the same person keeps the same color across renders.
 */
const BLOB_COLORS = [
  "rgba(181, 201, 168, 0.55)", // sage
  "rgba(244, 199, 163, 0.55)", // peach
  "rgba(212, 134, 109, 0.45)", // terracotta
  "rgba(220, 190, 127, 0.55)", // gold
  "rgba(232, 181, 176, 0.55)", // blush
  "rgba(181, 188, 143, 0.55)", // olive
] as const;

function blobFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) | 0;
  }
  return BLOB_COLORS[Math.abs(hash) % BLOB_COLORS.length];
}

export default function MemberTile({ member, onHover }: Props) {
  const initial = member.name.trim().slice(0, 1);
  const blob = blobFor(member.id);

  return (
    <button
      type="button"
      onClick={() => $modalMember.set(member.id)}
      onMouseEnter={() => onHover?.(member)}
      onMouseLeave={() => onHover?.(null)}
      onFocus={() => onHover?.(member)}
      onBlur={() => onHover?.(null)}
      className="group block w-[120px] sm:w-[128px] text-center px-2 py-3 rounded-md hover:bg-cream/40 transition-colors"
      aria-label={`Xem chi tiết ${member.name}`}
    >
      {/* Watercolor portrait with soft color halo */}
      <span className="relative inline-block">
        <span
          aria-hidden="true"
          className="absolute -inset-2 rounded-full blur-md"
          style={{ background: blob }}
        />
        <span className="relative block size-16 sm:size-[72px] overflow-hidden rounded-full border border-cream/80 shadow-paper-1 group-hover:scale-[1.04] transition-transform">
          {member.photo ? (
            <img
              src={member.photo}
              alt=""
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <span className="flex w-full h-full items-center justify-center bg-cream text-gold-2/60 font-display italic text-2xl">
              {initial}
            </span>
          )}
        </span>
      </span>

      <span className="block mt-3 font-semibold text-ink text-[12px] sm:text-[13px] leading-tight truncate max-w-full">
        {member.name}
      </span>
      {member.role && (
        <span className="block mt-0.5 text-[10px] text-ink-3 leading-tight truncate max-w-full">
          {member.role}{member.isFamilyHead ? " · Tộc trưởng" : ""}
        </span>
      )}
    </button>
  );
}
