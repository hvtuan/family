/**
 * Public-facing album — masonry grid + fullscreen lightbox + year
 * filter chips. Uses the same react-photo-album + yet-another-react-
 * lightbox stack as the admin media hub but styled for the paper
 * theme of the public site.
 */
import { useMemo, useState } from "react";
import {
  MasonryPhotoAlbum,
  type Photo as PhotoAlbumPhoto,
  type RenderImageContext,
} from "react-photo-album";
import "react-photo-album/masonry.css";
import Lightbox, { type Slide } from "yet-another-react-lightbox";
import Captions from "yet-another-react-lightbox/plugins/captions";
import Fullscreen from "yet-another-react-lightbox/plugins/fullscreen";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import Thumbnails from "yet-another-react-lightbox/plugins/thumbnails";
import "yet-another-react-lightbox/styles.css";
import "yet-another-react-lightbox/plugins/captions.css";
import "yet-another-react-lightbox/plugins/thumbnails.css";

export type AlbumPhoto = {
  id: string;
  kind: "image" | "video";
  src: string;
  thumb: string | null;
  poster: string | null;
  alt: string;
  caption: string;
  captionEn: string;
  year: number | null;
  location: string | null;
  durationSeconds: number | null;
  width: number;
  height: number;
};

interface Props {
  photos: AlbumPhoto[];
}

function durationLabel(s?: number | null): string {
  if (!s || !Number.isFinite(s) || s <= 0) return "";
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

export default function PublicAlbum({ photos }: Props) {
  const [yearFilter, setYearFilter] = useState<number | "">("");
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const years = useMemo(
    () =>
      Array.from(
        new Set(photos.map((p) => p.year).filter((y): y is number => typeof y === "number")),
      ).sort((a, b) => b - a),
    [photos],
  );

  const filtered = useMemo(() => {
    if (yearFilter === "") return photos;
    return photos.filter((p) => p.year === yearFilter);
  }, [photos, yearFilter]);

  // Group filtered photos by year for visual structure on the page.
  const groups = useMemo(() => {
    const map = new Map<string, AlbumPhoto[]>();
    for (const p of filtered) {
      const key = p.year ? String(p.year) : "Không rõ năm";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    return Array.from(map.entries()).sort(([a], [b]) => {
      if (a === "Không rõ năm") return 1;
      if (b === "Không rõ năm") return -1;
      return Number(b) - Number(a);
    });
  }, [filtered]);

  const slides: Slide[] = useMemo(
    () =>
      filtered.map((p): Slide => {
        if (p.kind === "video") {
          return {
            type: "video",
            sources: [{ src: p.src, type: "video/mp4" }],
            poster: p.poster ?? p.thumb ?? undefined,
            description: p.caption,
            title: p.alt,
          } as unknown as Slide;
        }
        return {
          src: p.src,
          width: Math.max(p.width || 1, 800),
          height: Math.max(p.height || 1, 600),
          alt: p.alt,
          description: p.caption,
          title: p.alt,
        } as Slide;
      }),
    [filtered],
  );

  return (
    <div className="space-y-8">
      {years.length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-display text-sm text-ink-3">Năm:</span>
          <Chip active={yearFilter === ""} onClick={() => setYearFilter("")}>
            Tất cả
          </Chip>
          {years.map((y) => (
            <Chip
              key={y}
              active={yearFilter === y}
              onClick={() => setYearFilter(y)}
            >
              {y}
            </Chip>
          ))}
          <span className="ml-auto font-mono text-xs text-ink-3 tabular-nums">
            {filtered.length} ảnh / video
          </span>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-line bg-cream/50 px-6 py-16 text-center">
          <p className="font-display text-base text-ink-2">
            Không có ảnh nào trong năm này.
          </p>
        </div>
      ) : (
        <div className="space-y-10">
          {groups.map(([year, items]) => (
            <YearSection
              key={year}
              year={year}
              items={items}
              onOpen={(p) => {
                const idx = filtered.findIndex((x) => x.id === p.id);
                if (idx >= 0) setLightboxIndex(idx);
              }}
            />
          ))}
        </div>
      )}

      <Lightbox
        open={lightboxIndex !== null}
        index={lightboxIndex ?? 0}
        close={() => setLightboxIndex(null)}
        slides={slides}
        plugins={[Captions, Fullscreen, Zoom, Thumbnails]}
        carousel={{ finite: true, preload: 2 }}
        thumbnails={{ position: "bottom", border: 0, gap: 8 }}
        captions={{ descriptionTextAlign: "center" }}
        styles={{ container: { backgroundColor: "rgba(20, 14, 8, 0.95)" } }}
      />
    </div>
  );
}

function YearSection({
  year,
  items,
  onOpen,
}: {
  year: string;
  items: AlbumPhoto[];
  onOpen: (p: AlbumPhoto) => void;
}) {
  type LocalPhoto = PhotoAlbumPhoto & { meta: AlbumPhoto };

  const albumPhotos: LocalPhoto[] = items.map((p) => ({
    src: p.thumb ?? p.poster ?? p.src,
    width: Math.max(p.width || 1, 4),
    height: Math.max(p.height || 1, 3),
    alt: p.alt,
    meta: p,
  }));

  return (
    <section>
      <header className="mb-4 flex items-baseline gap-3 border-b border-line pb-2">
        <h2 className="font-display text-xl text-ink">
          {year === "Không rõ năm" ? year : `Năm ${year}`}
        </h2>
        <span className="font-mono text-xs uppercase tracking-wider text-ink-3 tabular-nums">
          {items.length} ảnh
        </span>
      </header>
      <MasonryPhotoAlbum
        photos={albumPhotos}
        columns={(width) => {
          if (width < 480) return 1;
          if (width < 768) return 2;
          if (width < 1280) return 3;
          return 4;
        }}
        spacing={12}
        render={{
          image: (props, ctx) => (
            <PhotoTile imgProps={props} ctx={ctx} meta={(ctx.photo as LocalPhoto).meta} onOpen={onOpen} />
          ),
        }}
      />
    </section>
  );
}

function PhotoTile({
  imgProps,
  ctx,
  meta,
  onOpen,
}: {
  imgProps: React.ImgHTMLAttributes<HTMLImageElement>;
  ctx: RenderImageContext;
  meta: AlbumPhoto;
  onOpen: (p: AlbumPhoto) => void;
}) {
  const isVideo = meta.kind === "video";
  const dur = durationLabel(meta.durationSeconds);
  return (
    <div
      className="group relative overflow-hidden rounded-xl border border-line bg-cream shadow-paper-1 transition-shadow hover:shadow-paper-2"
      style={{ width: ctx.width, height: ctx.height }}
    >
      <button
        type="button"
        onClick={() => onOpen(meta)}
        className="block h-full w-full"
        title={meta.alt}
      >
        {imgProps.src ? (
          <img
            {...imgProps}
            loading="lazy"
            decoding="async"
            className="block h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-3xl text-ink-3">
            {isVideo ? "🎬" : "🖼️"}
          </div>
        )}
      </button>

      {isVideo && (
        <>
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-ink/60 text-cream shadow-paper-2 backdrop-blur-sm">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
          </div>
          {dur && (
            <span className="absolute bottom-2 right-2 rounded bg-ink/70 px-1.5 py-0.5 text-[10px] font-medium text-cream tabular-nums">
              {dur}
            </span>
          )}
        </>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/85 via-ink/40 to-transparent p-3 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
        <p className="line-clamp-2 font-display text-sm text-cream">{meta.caption}</p>
        {meta.location && (
          <p className="mt-0.5 text-[11px] text-cream/80">{meta.location}</p>
        )}
      </div>
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-xs font-medium tabular-nums transition-colors " +
        (active
          ? "border-vermilion bg-vermilion text-cream"
          : "border-line bg-cream text-ink-2 hover:bg-paper-2")
      }
    >
      {children}
    </button>
  );
}
