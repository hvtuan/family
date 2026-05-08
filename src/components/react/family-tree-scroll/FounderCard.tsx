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

export default function FounderCard({ member }: Props) {
  return (
    <button
      type="button"
      onClick={() => $modalMember.set(member.id)}
      className="group relative block w-[320px] rounded-md border border-gold-2/40 bg-cream/70 p-8 shadow-[0_24px_60px_-30px_rgba(120,80,40,0.35)] hover:shadow-[0_24px_60px_-20px_rgba(120,80,40,0.5)] transition-all text-left"
      aria-label={`Mở chi tiết về ${member.name}`}
    >
      {/* Lotus seal accent top-right */}
      <span aria-hidden="true" className="absolute right-4 top-4 text-2xl text-gold-2/40">🪷</span>

      <p className="u-kicker mb-3">Tổ tiên</p>
      <h3
        className="font-display italic text-ink m-0"
        style={{ fontSize: "var(--text-3xl)", lineHeight: 1.1 }}
      >
        {member.name}
      </h3>

      {member.role && (
        <p className="mt-2 text-sm text-ink-2 m-0">{member.role}{member.isFamilyHead ? " · Tộc trưởng" : ""}</p>
      )}

      <p className="mt-3 text-sm text-ink-3 tabular-nums m-0">{years(member)}</p>
      {member.birthPlace && (
        <p className="mt-1 text-xs italic text-ink-3 m-0">{member.birthPlace}</p>
      )}

      {member.isFamilyHead && (
        <span className="absolute right-6 bottom-6 text-vermilion text-2xl opacity-70" aria-hidden="true">⊛</span>
      )}
    </button>
  );
}
