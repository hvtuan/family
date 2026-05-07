/**
 * Public homepage hero slideshow. Full-bleed image / video carousel
 * with embla-carousel-react + autoplay plugin. Renders below the
 * sticky header and above the rest of the homepage.
 *
 * Falls back to NULL render when no slides → caller (index.astro)
 * uses the static Lotus hero instead.
 *
 * Each slide:
 *   - Image: <img object-cover> filling the viewport
 *   - Video: <video autoplay muted loop playsinline poster=...>
 *   - Dark gradient overlay for text legibility
 *   - Optional headline + CTA over the bottom-left
 *
 * UX:
 *   - Auto-advance per slide.duration_ms (>0). 0 = static slide.
 *   - Pause on hover; pauses video too.
 *   - Click dot to jump.
 *   - prev/next arrows on hover (≥md screens).
 *   - When only 1 slide, no controls.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import Autoplay from "embla-carousel-autoplay";

export type HeroSlide = {
  id: number;
  kind: "image" | "video";
  src: string;
  poster: string | null;
  thumb: string | null;
  caption: string;
  altVi: string | null;
  headlineVi: string | null;
  headlineEn: string | null;
  ctaLabel: string | null;
  ctaHref: string | null;
  durationMs: number;
};

interface Props {
  slides: HeroSlide[];
  /** Section height. Default 70vh; pass "100vh" for full screen. */
  height?: string;
}

export default function HeroSlideshow({ slides, height = "70vh" }: Props) {
  if (slides.length === 0) return null;

  // Median duration across slides — embla autoplay accepts a single
  // delay so we use the first slide's value (0 disables).
  const delay = slides[0].durationMs > 0 ? slides[0].durationMs : 6000;
  const autoplay = slides.length > 1 && slides[0].durationMs > 0;

  const [emblaRef, emblaApi] = useEmblaCarousel(
    { loop: true, align: "start" },
    autoplay ? [Autoplay({ delay, stopOnInteraction: false, stopOnMouseEnter: true })] : [],
  );
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (!emblaApi) return;
    const onSelect = () => setCurrent(emblaApi.selectedScrollSnap());
    emblaApi.on("select", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
    };
  }, [emblaApi]);

  const scrollTo = useCallback(
    (idx: number) => emblaApi?.scrollTo(idx),
    [emblaApi],
  );
  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);

  return (
    <section
      className="relative w-full overflow-hidden bg-ink"
      style={{ height }}
      aria-label="Slideshow gia đình"
    >
      <div ref={emblaRef} className="h-full overflow-hidden">
        <div className="flex h-full">
          {slides.map((s, i) => (
            <SlideView key={s.id} slide={s} active={current === i} />
          ))}
        </div>
      </div>

      {/* Dark gradient overlay — bottom 60% reads as a text scrim */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, transparent 0%, transparent 35%, rgba(20, 14, 8, 0.55) 80%, rgba(20, 14, 8, 0.85) 100%)",
        }}
        aria-hidden="true"
      />

      {/* Active slide overlay text + CTA */}
      <SlideOverlay slide={slides[current]} />

      {/* Prev / next arrows (≥md, only when >1 slide) */}
      {slides.length > 1 && (
        <>
          <button
            type="button"
            onClick={scrollPrev}
            className="hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 size-12 items-center justify-center rounded-full bg-ink/30 text-paper backdrop-blur-md transition hover:bg-ink/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-paper"
            aria-label="Slide trước"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
          <button
            type="button"
            onClick={scrollNext}
            className="hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 size-12 items-center justify-center rounded-full bg-ink/30 text-paper backdrop-blur-md transition hover:bg-ink/50 focus:outline-none focus-visible:ring-2 focus-visible:ring-paper"
            aria-label="Slide sau"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
        </>
      )}

      {/* Dot indicators */}
      {slides.length > 1 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => scrollTo(i)}
              aria-label={`Tới slide ${i + 1}`}
              className={`h-2 rounded-full transition-all ${
                current === i ? "w-8 bg-paper" : "w-2 bg-paper/40 hover:bg-paper/60"
              }`}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function SlideView({ slide: s, active }: { slide: HeroSlide; active: boolean }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Pause/play video as it becomes active so we don't have multiple
  // videos playing in the carousel at once.
  useEffect(() => {
    if (s.kind !== "video" || !videoRef.current) return;
    if (active) {
      videoRef.current.play().catch(() => {
        /* Autoplay may be blocked; user can click play manually. */
      });
    } else {
      videoRef.current.pause();
    }
  }, [s.kind, active]);

  return (
    <div className="relative h-full w-full shrink-0 grow-0 basis-full">
      {s.kind === "video" ? (
        <video
          ref={videoRef}
          src={s.src}
          poster={s.poster ?? undefined}
          autoPlay={active}
          muted
          loop
          playsInline
          className="absolute inset-0 h-full w-full object-cover"
        >
          <track kind="captions" />
        </video>
      ) : (
        <img
          src={s.src}
          alt={s.altVi ?? s.caption}
          loading="eager"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}
    </div>
  );
}

function SlideOverlay({ slide: s }: { slide: HeroSlide }) {
  const headline = s.headlineVi ?? s.altVi ?? s.caption;
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 flex flex-col items-start gap-4 px-6 pb-16 sm:px-10 md:pb-20 lg:px-16 max-w-[1240px] mx-auto">
      {headline && (
        <div className="pointer-events-auto max-w-2xl">
          <h2
            className="font-display font-bold text-paper drop-shadow-lg"
            style={{ fontSize: "clamp(1.6rem, 4vw, 2.6rem)", lineHeight: 1.15 }}
          >
            {headline}
          </h2>
          {s.headlineEn && (
            <p
              lang="en"
              className="mt-1 italic text-paper/85 drop-shadow"
              style={{ fontSize: "var(--text-base)" }}
            >
              {s.headlineEn}
            </p>
          )}
        </div>
      )}
      {s.ctaLabel && s.ctaHref && (
        <a
          href={s.ctaHref}
          className="pointer-events-auto u-btn u-btn-primary u-btn-lg"
        >
          {s.ctaLabel}
        </a>
      )}
    </div>
  );
}
