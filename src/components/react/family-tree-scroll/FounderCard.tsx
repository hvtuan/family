import { $modalMember } from "@/stores/ui";
import type { ClientMember } from "@/lib/members-client";

interface Props { member: ClientMember; }

function years(m: ClientMember): string {
  const b = m.born ? new Date(m.born).getFullYear() : null;
  const d = m.died ? new Date(m.died).getFullYear() : null;
  if (b && d) return `${b} — ${d}`;
  if (b) return `${b} — nay`;
  return "—";
}

/**
 * Founder mega tablet — gen 1 anchor of the lineage.
 *
 * Aesthetic: bài vị từ đường upgraded with portrait, ornate corner
 * accents, vermilion seal stamp, calligraphy name, and a decorative
 * frame echoing imperial Đại Nam thực lục manuscripts.
 */
export default function FounderCard({ member }: Props) {
  return (
    <button
      type="button"
      onClick={() => $modalMember.set(member.id)}
      className="group relative block w-[300px] sm:w-[340px] text-center"
      aria-label={`Mở chi tiết về ${member.name}`}
    >
      {/* Outer frame with arc top + corner ornaments */}
      <span
        className="relative block overflow-hidden border-2 border-gold-2/55 bg-cream/85 shadow-[0_28px_70px_-30px_rgba(120,80,40,0.45)] group-hover:shadow-[0_28px_70px_-20px_rgba(120,80,40,0.6)] transition-all"
        style={{
          borderTopLeftRadius: "44px 56px",
          borderTopRightRadius: "44px 56px",
          borderBottomLeftRadius: "8px",
          borderBottomRightRadius: "8px",
        }}
      >
        {/* Corner ornaments — gold L-brackets, larger for founder */}
        <CornerL position="top-left" />
        <CornerL position="top-right" />
        <CornerL position="bottom-left" />
        <CornerL position="bottom-right" />

        {/* Vermilion seal stamp */}
        {member.isFamilyHead && (
          <span
            aria-hidden="true"
            className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full border border-vermilion/60 text-vermilion font-bold text-lg shadow-paper-1 bg-cream/85"
            style={{ transform: "rotate(-8deg)", letterSpacing: 0 }}
            title="Tộc trưởng"
          >
            ⊛
          </span>
        )}

        {/* Inner double-rule frame for depth */}
        <span
          aria-hidden="true"
          className="absolute inset-3 border border-gold-2/25 pointer-events-none"
          style={{
            borderTopLeftRadius: "32px 44px",
            borderTopRightRadius: "32px 44px",
            borderBottomLeftRadius: "4px",
            borderBottomRightRadius: "4px",
          }}
        />

        {/* Lotus seal small badge — kicker decoration */}
        <span aria-hidden="true" className="block pt-7 pb-1.5">
          <svg
            className="mx-auto text-gold-2"
            width="32" height="32" viewBox="0 0 32 32" fill="none"
          >
            <g stroke="currentColor" strokeWidth="0.8" opacity="0.85">
              <path d="M16 6 C 11 11, 9 17, 16 22 C 23 17, 21 11, 16 6 Z" fill="currentColor" fillOpacity="0.18" />
              <path d="M9 11 C 6 16, 9 22, 14 22" />
              <path d="M23 11 C 26 16, 23 22, 18 22" />
              <line x1="16" y1="22" x2="16" y2="27" />
            </g>
          </svg>
        </span>

        <span className="block px-7 pb-7">
          <span className="block u-kicker mb-3 text-[10px]">Tổ tiên · Đời thứ 1</span>

          {/* Portrait if exists */}
          {member.photo && (
            <span
              aria-hidden={false}
              className="block mx-auto mb-4 overflow-hidden border border-gold-2/50"
              style={{
                width: "168px",
                aspectRatio: "4 / 5",
                filter: "sepia(0.15) saturate(0.92)",
                borderTopLeftRadius: "12px 16px",
                borderTopRightRadius: "12px 16px",
                borderBottomLeftRadius: "4px",
                borderBottomRightRadius: "4px",
              }}
            >
              <img src={member.photo} alt="" className="w-full h-full object-cover" loading="eager" />
            </span>
          )}

          {/* Name calligraphy */}
          <span
            className="block font-script text-gold-2 leading-[1.05] m-0"
            style={{ fontSize: "2.2rem" }}
          >
            {member.name}
          </span>

          {/* Decorative under-rule */}
          <span aria-hidden="true" className="mt-3 mb-3 flex items-center justify-center gap-2">
            <span className="h-px w-8 bg-gold-2/45" />
            <span className="text-gold-2 text-xs">❀</span>
            <span className="h-px w-8 bg-gold-2/45" />
          </span>

          {member.role && (
            <span className="block text-[12px] text-ink-2 m-0 italic">
              {member.role}{member.isFamilyHead ? " · Tộc trưởng" : ""}
            </span>
          )}

          <span className="block mt-2 text-[12px] text-ink-3 tabular-nums tracking-wider">
            {years(member)}
          </span>

          {member.birthPlace && (
            <span className="block mt-1 text-[11px] italic text-ink-3">
              {member.birthPlace}
            </span>
          )}
        </span>
      </span>
    </button>
  );
}

function CornerL({ position }: { position: "top-left" | "top-right" | "bottom-left" | "bottom-right" }) {
  const baseClasses = "absolute text-gold-2/65";
  const map: Record<typeof position, { cls: string; d: string; transform?: string }> = {
    "top-left":     { cls: "left-2 top-3",      d: "M0 14 L0 4 Q0 0 4 0 L14 0",            transform: undefined },
    "top-right":    { cls: "right-2 top-3",     d: "M0 14 L0 4 Q0 0 4 0 L14 0",            transform: "scaleX(-1)" },
    "bottom-left":  { cls: "left-2 bottom-2",   d: "M0 14 L0 4 Q0 0 4 0 L14 0",            transform: "scaleY(-1)" },
    "bottom-right": { cls: "right-2 bottom-2",  d: "M0 14 L0 4 Q0 0 4 0 L14 0",            transform: "scale(-1, -1)" },
  };
  const item = map[position];
  return (
    <svg
      aria-hidden="true"
      className={`${baseClasses} ${item.cls}`}
      width="16" height="16" viewBox="0 0 16 16"
      style={{ transform: item.transform }}
    >
      <path d={item.d} stroke="currentColor" strokeWidth="1.2" fill="none" />
    </svg>
  );
}
