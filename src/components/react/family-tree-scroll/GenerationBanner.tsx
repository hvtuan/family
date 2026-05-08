interface Props { gen: number; }

/**
 * Ornate full-width banner separating each generation. Styled like a
 * Vietnamese hoành phi — calligraphy center label flanked by scroll-end
 * motifs (curling cloud-like svg ornaments).
 */
export default function GenerationBanner({ gen }: Props) {
  return (
    <div
      className="relative my-12 sm:my-16 flex items-center justify-center"
      aria-label={`Đời thứ ${gen}`}
    >
      {/* Full-width gradient backdrop */}
      <span
        aria-hidden="true"
        className="absolute inset-x-4 top-1/2 -translate-y-1/2 h-12 rounded-sm"
        style={{
          background:
            "linear-gradient(90deg, transparent 0%, rgba(168, 133, 63, 0.08) 18%, rgba(168, 133, 63, 0.16) 50%, rgba(168, 133, 63, 0.08) 82%, transparent 100%)",
        }}
      />

      {/* Center content */}
      <div className="relative z-10 flex items-center gap-4 px-6 py-2">
        <ScrollEnd direction="left" />
        <div className="flex flex-col items-center">
          <span
            className="text-[10px] tracking-[0.32em] uppercase text-gold-2/80 font-semibold"
          >
            Đời thứ
          </span>
          <span
            className="font-script text-gold-2 leading-none"
            style={{ fontSize: "2rem" }}
          >
            {romanizeGen(gen)}
          </span>
        </div>
        <ScrollEnd direction="right" />
      </div>
    </div>
  );
}

/**
 * Decorative end-cap SVG suggesting a rolled-up scroll edge.
 */
function ScrollEnd({ direction }: { direction: "left" | "right" }) {
  const flip = direction === "right" ? "scale(-1, 1)" : undefined;
  return (
    <svg
      aria-hidden="true"
      width="60" height="22" viewBox="0 0 60 22"
      style={{ transform: flip }}
      className="text-gold-2/70"
    >
      <g stroke="currentColor" strokeWidth="0.9" fill="none">
        {/* Base rule */}
        <line x1="0" y1="11" x2="42" y2="11" />
        {/* Curl */}
        <path d="M42 11 Q 50 11, 52 7 Q 54 3, 50 3 Q 46 3, 46 8 Q 46 13, 50 16 Q 54 19, 58 16" />
        {/* Tiny dot inside curl */}
        <circle cx="50" cy="8" r="1.2" fill="currentColor" stroke="none" opacity="0.7" />
      </g>
    </svg>
  );
}

function romanizeGen(n: number): string {
  if (n < 1) return String(n);
  if (n > 20) return String(n);
  const numerals = [
    "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X",
    "XI", "XII", "XIII", "XIV", "XV", "XVI", "XVII", "XVIII", "XIX", "XX",
  ];
  return numerals[n - 1];
}
