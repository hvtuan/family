import { motion, AnimatePresence } from "motion/react";
import type { ClientMember } from "@/lib/members-client";

interface Props {
  member: ClientMember | null;
  members: ClientMember[];
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
}

/**
 * Side câu đối panel revealing extra detail when a member tile is
 * hovered or focused. Desktop-only (hidden lg:block) — mobile users tap
 * the tile to open the full modal directly.
 *
 * Reused across the public family tree (FamilyTree.tsx canvas + future
 * variants).
 */
export default function MemberHoverPanel({ member, members }: Props) {
  const byId = new Map(members.map((m) => [m.id, m]));
  const father = member?.father ? byId.get(member.father) : null;
  const mother = member?.mother ? byId.get(member.mother) : null;
  const spouse = member?.spouse ? byId.get(member.spouse) : null;
  const childrenCount = member
    ? members.filter((m) => m.father === member.id || m.mother === member.id).length
    : 0;

  return (
    <AnimatePresence>
      {member && (
        <motion.aside
          key={member.id}
          initial={{ opacity: 0, x: 16 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 16 }}
          transition={{ duration: 0.22, ease: "easeOut" }}
          className="hidden lg:block fixed right-6 top-32 w-[280px] rounded-md border border-gold-2/40 bg-cream/95 backdrop-blur p-5 shadow-paper-2 z-40 pointer-events-none"
          role="complementary"
          aria-live="polite"
        >
          <p className="u-kicker mb-2">
            {member.role}{member.isFamilyHead ? " · Tộc trưởng" : ""}
          </p>
          <h4
            className="font-display italic text-ink m-0"
            style={{ fontSize: "var(--text-xl)" }}
          >
            {member.name}
          </h4>

          <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
            {member.born && (
              <>
                <dt className="text-ink-3">Sinh</dt>
                <dd className="text-ink-2 tabular-nums m-0">{formatDate(member.born)}</dd>
              </>
            )}
            {member.died && (
              <>
                <dt className="text-ink-3">Mất</dt>
                <dd className="text-ink-2 tabular-nums m-0">{formatDate(member.died)}</dd>
              </>
            )}
            {member.birthPlace && (
              <>
                <dt className="text-ink-3">Quê</dt>
                <dd className="text-ink-2 m-0">{member.birthPlace}</dd>
              </>
            )}
            {father && (
              <>
                <dt className="text-ink-3">Cha</dt>
                <dd className="text-ink-2 m-0 italic">{father.name}</dd>
              </>
            )}
            {mother && (
              <>
                <dt className="text-ink-3">Mẹ</dt>
                <dd className="text-ink-2 m-0 italic">{mother.name}</dd>
              </>
            )}
            {spouse && (
              <>
                <dt className="text-ink-3">Vợ/Chồng</dt>
                <dd className="text-ink-2 m-0 italic">{spouse.name}</dd>
              </>
            )}
            {childrenCount > 0 && (
              <>
                <dt className="text-ink-3">Con</dt>
                <dd className="text-ink-2 m-0">{childrenCount} người</dd>
              </>
            )}
          </dl>

          <p className="mt-4 text-[10px] italic text-ink-3 m-0">Bấm vào để xem đầy đủ →</p>
        </motion.aside>
      )}
    </AnimatePresence>
  );
}
