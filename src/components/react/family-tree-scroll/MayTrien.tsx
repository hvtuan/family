/**
 * Mây triện (cloud-scroll) decorative side border. Vietnamese traditional
 * motif used on hoành phi / câu đối / pottery — repeating rolling cloud.
 *
 * Renders a vertical SVG strip with an alternating curl pattern stacked
 * to fill the height. Two variants: "left" and "right" — right side is
 * mirrored.
 */
interface Props { side: "left" | "right"; }

export default function MayTrien({ side }: Props) {
  // Each repeat unit is ~48px tall. We stack many to fill any height via
  // CSS `background-image` would have been simpler but won't recolor with
  // currentColor — inline SVG keeps the mây triện color tied to gold-2.
  // We render ONE stylized scroll motif and use repetition via pattern.
  const flip = side === "right" ? "scaleX(-1)" : undefined;
  return (
    <div
      aria-hidden="true"
      className={`hidden md:block absolute top-12 bottom-12 w-7 ${side === "left" ? "left-0" : "right-0"} pointer-events-none`}
      style={{ transform: flip, opacity: 0.55 }}
    >
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 28 480"
        preserveAspectRatio="none"
        className="text-gold-2"
      >
        <defs>
          <pattern id={`may-trien-${side}`} x="0" y="0" width="28" height="48" patternUnits="userSpaceOnUse">
            <g stroke="currentColor" strokeWidth="1" fill="none">
              {/* Spine */}
              <line x1="6" y1="0" x2="6" y2="48" opacity="0.7" />
              {/* Cloud curl going right */}
              <path d="M6 12 C 14 12, 18 8, 18 14 C 18 20, 12 20, 12 16 C 12 13, 16 13, 16 16" />
              {/* Inner dot */}
              <circle cx="16" cy="16" r="0.9" fill="currentColor" stroke="none" opacity="0.65" />
              {/* Cloud curl going right (mirrored, lower) */}
              <path d="M6 36 C 14 36, 18 32, 18 38 C 18 44, 12 44, 12 40 C 12 37, 16 37, 16 40" />
              <circle cx="16" cy="40" r="0.9" fill="currentColor" stroke="none" opacity="0.65" />
            </g>
          </pattern>
        </defs>
        <rect width="28" height="100%" fill={`url(#may-trien-${side})`} />
      </svg>
    </div>
  );
}
