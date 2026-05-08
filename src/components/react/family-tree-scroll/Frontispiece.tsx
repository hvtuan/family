interface Props {
  surname: string;
  hometown: string;
  established: number | null;
  publicationYear: number;
  generationsCount: number;
  membersCount: number;
}

/**
 * Centered title block above the tree. Minimal — large serif italic
 * heading + thin subtitle, inspired by modern Western family tree
 * templates (e.g. "Our Blended Family Tree" examples).
 */
export default function Frontispiece({
  surname, hometown, established, publicationYear,
  generationsCount, membersCount,
}: Props) {
  return (
    <header className="text-center mb-12 sm:mb-16">
      <h1
        className="font-display italic text-ink m-0 leading-tight"
        style={{ fontSize: "clamp(2.25rem, 5vw, 3.5rem)" }}
      >
        Cây gia phả họ {surname}
      </h1>
      <p className="mt-3 text-sm sm:text-base text-ink-3 max-w-xl mx-auto m-0">
        {generationsCount} thế hệ · {membersCount} thành viên
        {hometown && (
          <>
            <span className="mx-2 opacity-60">·</span>
            {hometown}
          </>
        )}
      </p>
      {established && (
        <p className="mt-1 text-xs text-ink-3 tabular-nums tracking-wider m-0">
          {established} — {publicationYear}
        </p>
      )}
    </header>
  );
}
