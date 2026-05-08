interface Props {
  surname: string;
  hometown: string;
  motto: string;
  established: number | null;
  publicationYear: number;
  generationsCount: number;
  membersCount: number;
}

/**
 * Page header above the tree — like a book frontispiece. Inspired by
 * Đại Nam thực lục manuscript opening pages: vermilion seal stamp,
 * calligraphy surname, decorative inner double-rule frame, ornate
 * corner accents, motto pull-quote, established/edition years.
 */
export default function Frontispiece({
  surname, hometown, motto, established, publicationYear,
  generationsCount, membersCount,
}: Props) {
  return (
    <header className="relative mb-12 sm:mb-16 mx-auto max-w-[640px]">
      <div
        className="relative bg-cream/85 border-2 border-gold-2/55 px-8 sm:px-12 py-10 sm:py-14 text-center shadow-[0_28px_60px_-30px_rgba(120,80,40,0.4)]"
        style={{
          borderTopLeftRadius: "20px 32px",
          borderTopRightRadius: "20px 32px",
          borderBottomLeftRadius: "8px",
          borderBottomRightRadius: "8px",
        }}
      >
        {/* Inner double-rule frame */}
        <span
          aria-hidden="true"
          className="absolute inset-3 border border-gold-2/25 pointer-events-none"
          style={{
            borderTopLeftRadius: "12px 22px",
            borderTopRightRadius: "12px 22px",
            borderBottomLeftRadius: "4px",
            borderBottomRightRadius: "4px",
          }}
        />

        {/* Vermilion seal top-right */}
        <span
          aria-hidden="true"
          className="absolute right-5 top-5 inline-flex h-12 w-12 items-center justify-center rounded-full border-2 border-vermilion/70 text-vermilion font-bold text-2xl bg-cream/85 shadow-paper-1"
          style={{ transform: "rotate(-9deg)" }}
        >
          ⊛
        </span>

        {/* Lotus motif */}
        <span aria-hidden="true" className="block mb-3">
          <svg className="mx-auto text-gold-2" width="36" height="36" viewBox="0 0 32 32" fill="none">
            <g stroke="currentColor" strokeWidth="0.9" opacity="0.85">
              <path d="M16 6 C 11 11, 9 17, 16 22 C 23 17, 21 11, 16 6 Z" fill="currentColor" fillOpacity="0.18" />
              <path d="M9 11 C 6 16, 9 22, 14 22" />
              <path d="M23 11 C 26 16, 23 22, 18 22" />
              <line x1="16" y1="22" x2="16" y2="27" />
            </g>
          </svg>
        </span>

        {/* Kicker */}
        <p
          className="text-[10px] sm:text-[11px] tracking-[0.32em] uppercase text-gold-2/85 font-semibold m-0"
        >
          Gia Phả · Genealogy
        </p>

        {/* Surname calligraphy */}
        <h1
          className="font-script text-gold-2 m-0 leading-[0.95] mt-3"
          style={{ fontSize: "clamp(3rem, 7vw, 4.5rem)" }}
        >
          Họ {surname}
        </h1>

        {/* Decorative under-rule */}
        <div className="mt-5 flex items-center justify-center gap-3" aria-hidden="true">
          <span className="h-px w-16 bg-gold-2/55" />
          <span className="text-gold-2 text-base">❀</span>
          <span className="h-px w-16 bg-gold-2/55" />
        </div>

        {/* Motto */}
        {motto && (
          <p className="mt-5 font-display italic text-ink-2 m-0" style={{ fontSize: "1.15rem" }}>
            "{motto}"
          </p>
        )}

        {/* Hometown + years */}
        <p className="mt-6 text-xs tracking-wider text-ink-3 tabular-nums m-0">
          {hometown}
          {established && (
            <>
              <span className="mx-2 opacity-60">·</span>
              <span>{established} — {publicationYear}</span>
            </>
          )}
        </p>

        {/* Stats line */}
        <p className="mt-3 text-xs text-ink-3 m-0">
          <span className="font-semibold text-ink">{membersCount}</span> thành viên
          <span className="mx-2 opacity-60">·</span>
          <span className="font-semibold text-ink">{generationsCount}</span> thế hệ
        </p>
      </div>
    </header>
  );
}
