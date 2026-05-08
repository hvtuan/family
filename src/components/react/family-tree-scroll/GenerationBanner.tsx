interface Props { gen: number; }

/**
 * Minimal generation row label — just a small muted "Đời thứ N" centered
 * with breathing room. Modern Western tree templates omit gen labels
 * (the role text on each tile carries that info), but Vietnamese gia phả
 * tradition expects 'đời thứ N' so we keep a subtle marker.
 */
export default function GenerationBanner({ gen }: Props) {
  return (
    <div
      className="my-10 sm:my-12 flex items-center justify-center"
      aria-label={`Đời thứ ${gen}`}
    >
      <span className="text-[10px] tracking-[0.32em] uppercase text-ink-3/70 font-semibold">
        Đời thứ {gen}
      </span>
    </div>
  );
}
