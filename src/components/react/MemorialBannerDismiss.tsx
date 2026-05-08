/**
 * Slim memorial banner with a soft slide-down entrance and dismiss
 * action that drops a per-(member, year) cookie. Pure presentational
 * island — server decides visibility, this just animates + dismisses.
 */
import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";

interface Props {
  cookieName: string;
  memberId: string;
  href: string;
  daysLabel: string;
  memberName: string;
}

export default function MemorialBannerDismiss({
  cookieName,
  href,
  daysLabel,
  memberName,
}: Props) {
  const [visible, setVisible] = useState(true);

  function dismiss() {
    document.cookie = `${cookieName}=1; path=/; max-age=${60 * 60 * 24 * 30}; SameSite=Lax`;
    setVisible(false);
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          role="status"
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.32, ease: "easeOut" }}
          className="border-b border-gold-2/30"
          style={{ background: "rgba(214, 160, 80, 0.10)" }}
        >
          <div className="max-w-[1240px] mx-auto px-5 py-2.5 flex items-center gap-3 text-sm">
            <span aria-hidden="true">🌸</span>
            <p className="m-0 text-ink leading-tight flex-1">
              <span className="text-ink-2">{daysLabel}</span>
              <span className="font-semibold text-ink ml-1.5">{memberName}</span>
            </p>
            <a
              href={href}
              className="text-jade font-semibold hover:text-vermilion transition-colors whitespace-nowrap"
            >
              Tưởng niệm →
            </a>
            <button
              type="button"
              onClick={dismiss}
              aria-label="Đóng thông báo"
              className="text-ink-3 hover:text-ink transition-colors -mr-1 px-2 py-1 leading-none"
            >
              ×
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
