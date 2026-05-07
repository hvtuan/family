/**
 * Pro-grade hub UI for /admin/media. Replaces the SSR Astro grid with a
 * single React island that wires up:
 *
 *   - react-photo-album: masonry layout with natural aspect ratios
 *     (instead of rigid 5-column squares).
 *   - yet-another-react-lightbox: fullscreen viewer with prev/next,
 *     zoom, captions; opens when the user clicks a thumbnail.
 *   - chip-based filters (multi-select tag, single-select kind/year/
 *     featured) wired to the URL via history.pushState — bookmarkable
 *     without a round-trip.
 *   - sticky year section headers grouping photos chronologically.
 *   - Skeleton loading, empty state with CTA, sonner toasts on bulk
 *     actions.
 *   - Bulk select via shadcn Checkbox; sticky bulk action bar.
 *
 * Data is SSR-fetched on the parent Astro page and passed in as a prop
 * (no fetch round-trip). Filters operate client-side over the in-memory
 * array — fine for ≤2000 photos / 10 users.
 */
import { useEffect, useMemo, useState } from "react";
import {
  MasonryPhotoAlbum,
  type RenderImageContext,
  type Photo as PhotoAlbumPhoto,
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
import { Image as ImageIcon, Search, Star, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

// ─── types ────────────────────────────────────────────────────────────────

export type MediaItem = {
  id: string;
  kind: "image" | "video";
  src: string;
  src_thumb: string | null;
  src_medium: string | null;
  alt_vi: string | null;
  caption: string;
  caption_en: string;
  year: number | null;
  location: string | null;
  album: string | null;
  featured: boolean;
  tags: string[];
  width: number | null;
  height: number | null;
  duration_seconds: number | null;
};

interface Props {
  items: MediaItem[];
  initialBanner?: { kind: "ok" | "err"; text: string } | null;
}

// ─── helpers ──────────────────────────────────────────────────────────────

function durationLabel(s?: number | null): string {
  if (s == null || !Number.isFinite(s) || s <= 0) return "";
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function thumbFor(p: MediaItem): string {
  if (p.kind === "video") return p.src_thumb || p.src_medium || "";
  return p.src_thumb || p.src_medium || p.src;
}

function fullSrcFor(p: MediaItem): string {
  if (p.kind === "video") return p.src_medium || p.src_thumb || p.src;
  return p.src_medium || p.src;
}

// Use the photo's stored dimensions if we have them; otherwise fall
// back to a 4:3 placeholder so the masonry layout still works.
function dimsFor(p: MediaItem): { width: number; height: number } {
  if (p.width && p.height && p.width > 0 && p.height > 0) {
    return { width: p.width, height: p.height };
  }
  return { width: 4, height: 3 };
}

function readUrlState() {
  const u = new URL(window.location.href);
  return {
    q: (u.searchParams.get("q") ?? "").toLowerCase(),
    year: u.searchParams.get("year") ?? "",
    kindFilter: u.searchParams.get("kind") ?? "",
    featuredOnly: u.searchParams.get("featured") === "1",
    selectedTags: (u.searchParams.get("tag") ?? "")
      .split(",").map((s) => s.trim()).filter(Boolean),
  };
}

function pushUrlState(state: ReturnType<typeof readUrlState>) {
  const u = new URL(window.location.href);
  if (state.q) u.searchParams.set("q", state.q);
  else u.searchParams.delete("q");
  if (state.year) u.searchParams.set("year", state.year);
  else u.searchParams.delete("year");
  if (state.kindFilter) u.searchParams.set("kind", state.kindFilter);
  else u.searchParams.delete("kind");
  if (state.featuredOnly) u.searchParams.set("featured", "1");
  else u.searchParams.delete("featured");
  if (state.selectedTags.length > 0) u.searchParams.set("tag", state.selectedTags.join(","));
  else u.searchParams.delete("tag");
  history.replaceState(null, "", u.toString());
}

// ─── component ────────────────────────────────────────────────────────────

export default function MediaLibrary({ items, initialBanner }: Props) {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  // Hydrate filter state from URL on first render.
  const [filters, setFilters] = useState(() =>
    typeof window === "undefined"
      ? { q: "", year: "", kindFilter: "", featuredOnly: false, selectedTags: [] as string[] }
      : readUrlState(),
  );

  useEffect(() => {
    if (!hydrated) return;
    pushUrlState(filters);
  }, [filters, hydrated]);

  // Initial banner (server-emitted result of bulk delete) flashed once.
  useEffect(() => {
    if (!initialBanner) return;
    if (initialBanner.kind === "ok") toast.success(initialBanner.text);
    else toast.error(initialBanner.text);
  }, [initialBanner]);

  // ── filter facets ──
  const allYears = useMemo(
    () =>
      Array.from(
        new Set(items.map((p) => p.year).filter((y): y is number => typeof y === "number")),
      ).sort((a, b) => b - a),
    [items],
  );

  const allTags = useMemo(
    () =>
      Array.from(
        new Set(items.flatMap((p) => (Array.isArray(p.tags) ? p.tags : []))),
      ).sort(),
    [items],
  );

  // ── filtered list ──
  const rows = useMemo(() => {
    return items.filter((p) => {
      if (filters.q) {
        const hay = [
          p.id, p.caption, p.caption_en, p.alt_vi ?? "",
          p.location ?? "", p.album ?? "",
          ...(Array.isArray(p.tags) ? p.tags : []),
        ].join(" ").toLowerCase();
        if (!hay.includes(filters.q)) return false;
      }
      if (filters.year && String(p.year ?? "") !== filters.year) return false;
      if (filters.kindFilter && (p.kind ?? "image") !== filters.kindFilter) return false;
      if (filters.featuredOnly && !p.featured) return false;
      if (
        filters.selectedTags.length > 0 &&
        !filters.selectedTags.every((t) => Array.isArray(p.tags) && p.tags.includes(t))
      ) {
        return false;
      }
      return true;
    });
  }, [items, filters]);

  // ── group by year for sticky section headers ──
  const groups = useMemo(() => {
    const map = new Map<string, MediaItem[]>();
    for (const p of rows) {
      const key = p.year ? String(p.year) : "Không rõ năm";
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(p);
    }
    // Sort: year DESC, "Không rõ năm" last.
    return Array.from(map.entries()).sort(([a], [b]) => {
      if (a === "Không rõ năm") return 1;
      if (b === "Không rõ năm") return -1;
      return Number(b) - Number(a);
    });
  }, [rows]);

  // ── selection state ──
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
  const clearSelection = () => setSelected(new Set());

  // ── lightbox state ──
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const lightboxSlides: Slide[] = useMemo(
    () =>
      rows.map((p): Slide => {
        if (p.kind === "video") {
          return {
            type: "video",
            sources: [{ src: p.src, type: "video/mp4" }],
            poster: p.src_medium ?? undefined,
            description: p.caption,
            title: p.alt_vi ?? p.caption,
          } as unknown as Slide;
        }
        const dims = dimsFor(p);
        return {
          src: fullSrcFor(p),
          width: dims.width * 200,
          height: dims.height * 200,
          alt: p.alt_vi ?? p.caption,
          description: p.caption,
          title: p.alt_vi ?? p.caption,
        } as Slide;
      }),
    [rows],
  );

  // ── bulk delete handler (POST to current URL) ──
  const [bulkBusy, setBulkBusy] = useState(false);
  const bulkDelete = async () => {
    if (selected.size === 0) return;
    if (!confirm(`Xóa ${selected.size} ảnh? Hành động này không hoàn tác được.`)) return;
    setBulkBusy(true);
    const fd = new FormData();
    fd.set("action", "bulk-delete");
    for (const id of selected) fd.append("ids", id);
    try {
      const res = await fetch("/admin/media", { method: "POST", body: fd });
      if (res.ok) {
        toast.success(`Đã xóa ${selected.size} ảnh.`);
        setTimeout(() => location.reload(), 600);
      } else {
        toast.error(`Xóa thất bại (${res.status}).`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Lỗi mạng.");
    } finally {
      setBulkBusy(false);
    }
  };

  // ── update helpers ──
  const setQ = (q: string) => setFilters((f) => ({ ...f, q: q.toLowerCase() }));
  const toggleTag = (t: string) =>
    setFilters((f) => ({
      ...f,
      selectedTags: f.selectedTags.includes(t)
        ? f.selectedTags.filter((x) => x !== t)
        : [...f.selectedTags, t],
    }));
  const setYear = (y: string) => setFilters((f) => ({ ...f, year: f.year === y ? "" : y }));
  const setKind = (k: "" | "image" | "video") =>
    setFilters((f) => ({ ...f, kindFilter: f.kindFilter === k ? "" : k }));
  const toggleFeatured = () =>
    setFilters((f) => ({ ...f, featuredOnly: !f.featuredOnly }));
  const clearAll = () =>
    setFilters({ q: "", year: "", kindFilter: "", featuredOnly: false, selectedTags: [] });

  const hasActiveFilter =
    filters.q || filters.year || filters.kindFilter || filters.featuredOnly ||
    filters.selectedTags.length > 0;

  // ── render ──

  // Pre-hydration skeleton that matches the eventual layout.
  if (!hydrated) {
    return <SkeletonGrid />;
  }

  return (
    <div className="space-y-6">
      <FilterBar
        q={filters.q}
        setQ={setQ}
        kindFilter={filters.kindFilter as "" | "image" | "video"}
        setKind={setKind}
        years={allYears}
        year={filters.year}
        setYear={setYear}
        tags={allTags}
        selectedTags={filters.selectedTags}
        toggleTag={toggleTag}
        featuredOnly={filters.featuredOnly}
        toggleFeatured={toggleFeatured}
        hasActiveFilter={!!hasActiveFilter}
        clearAll={clearAll}
        rowsCount={rows.length}
        totalCount={items.length}
      />

      {rows.length === 0 ? (
        <EmptyState hasFilter={!!hasActiveFilter} clearAll={clearAll} totalCount={items.length} />
      ) : (
        <div className="space-y-8">
          {groups.map(([year, groupItems]) => (
            <YearSection
              key={year}
              year={year}
              items={groupItems}
              selected={selected}
              toggleSelect={toggleSelect}
              onOpen={(p) => {
                const idx = rows.findIndex((r) => r.id === p.id);
                if (idx >= 0) setLightboxIndex(idx);
              }}
            />
          ))}
        </div>
      )}

      {/* Sticky bulk bar */}
      {selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background shadow-[0_-2px_10px_rgba(0,0,0,.04)]">
          <div className="mx-auto flex max-w-screen-2xl items-center justify-between px-6 py-3">
            <div className="text-sm text-foreground">
              Đã chọn <span className="font-semibold">{selected.size}</span> ảnh
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={clearSelection}>
                <X className="size-4" /> Bỏ chọn
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={bulkDelete}
                disabled={bulkBusy}
              >
                <Trash2 className="size-4" /> Xóa đã chọn
              </Button>
            </div>
          </div>
        </div>
      )}

      <Lightbox
        open={lightboxIndex !== null}
        index={lightboxIndex ?? 0}
        close={() => setLightboxIndex(null)}
        slides={lightboxSlides}
        plugins={[Captions, Fullscreen, Zoom, Thumbnails]}
        carousel={{ finite: true, preload: 2 }}
        thumbnails={{ position: "bottom", border: 0, gap: 8 }}
        captions={{ descriptionTextAlign: "center" }}
        styles={{ container: { backgroundColor: "rgba(0, 0, 0, 0.92)" } }}
        render={{
          buttonPrev: rows.length <= 1 ? () => null : undefined,
          buttonNext: rows.length <= 1 ? () => null : undefined,
        }}
        toolbar={{
          buttons: [
            <a
              key="open-detail"
              href={lightboxIndex !== null ? `/admin/media/${rows[lightboxIndex]?.id}` : "#"}
              className="yarl__button"
              title="Mở trang chi tiết"
            >
              ✏️
            </a>,
            "close",
          ],
        }}
      />
    </div>
  );
}

// ─── sub-components ───────────────────────────────────────────────────────

function FilterBar(props: {
  q: string;
  setQ: (v: string) => void;
  kindFilter: "" | "image" | "video";
  setKind: (k: "" | "image" | "video") => void;
  years: number[];
  year: string;
  setYear: (y: string) => void;
  tags: string[];
  selectedTags: string[];
  toggleTag: (t: string) => void;
  featuredOnly: boolean;
  toggleFeatured: () => void;
  hasActiveFilter: boolean;
  clearAll: () => void;
  rowsCount: number;
  totalCount: number;
}) {
  return (
    <div className="space-y-4 rounded-2xl border border-border bg-muted/40 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-64">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="search"
            value={props.q}
            onChange={(e) => props.setQ(e.target.value)}
            placeholder="Tìm theo tên, caption, alt, tag, địa điểm…"
            className="h-10 w-full rounded-lg border border-border bg-background pl-9 pr-3 text-sm shadow-theme-xs focus:border-primary/50 focus:outline-hidden focus:ring-3 focus:ring-ring/20"
          />
        </div>
        <div className="text-xs text-muted-foreground tabular-nums">
          {props.rowsCount}
          {props.rowsCount !== props.totalCount && ` / ${props.totalCount}`} mục
        </div>
        {props.hasActiveFilter && (
          <Button variant="ghost" size="sm" onClick={props.clearAll}>
            <X className="size-4" /> Xóa lọc
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Chip
          active={!props.kindFilter}
          onClick={() => props.setKind("")}
        >
          Tất cả
        </Chip>
        <Chip
          active={props.kindFilter === "image"}
          onClick={() => props.setKind("image")}
        >
          🖼️ Ảnh
        </Chip>
        <Chip
          active={props.kindFilter === "video"}
          onClick={() => props.setKind("video")}
        >
          🎬 Video
        </Chip>
        <span className="mx-2 h-5 w-px bg-border" />
        <Chip
          active={props.featuredOnly}
          onClick={props.toggleFeatured}
        >
          <Star className={cn("size-3", props.featuredOnly && "fill-current")} />
          Nổi bật
        </Chip>
      </div>

      {props.years.length > 0 && (
        <div>
          <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Năm</div>
          <div className="flex flex-wrap gap-1.5">
            {props.years.map((y) => (
              <Chip
                key={y}
                active={props.year === String(y)}
                onClick={() => props.setYear(String(y))}
              >
                {y}
              </Chip>
            ))}
          </div>
        </div>
      )}

      {props.tags.length > 0 && (
        <div>
          <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">Tag</div>
          <div className="flex flex-wrap gap-1.5">
            {props.tags.map((t) => (
              <Chip
                key={t}
                active={props.selectedTags.includes(t)}
                onClick={() => props.toggleTag(t)}
              >
                #{t}
              </Chip>
            ))}
          </div>
        </div>
      )}
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
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
        active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-background text-foreground hover:bg-accent",
      )}
    >
      {children}
    </button>
  );
}

function YearSection({
  year,
  items,
  selected,
  toggleSelect,
  onOpen,
}: {
  year: string;
  items: MediaItem[];
  selected: Set<string>;
  toggleSelect: (id: string) => void;
  onOpen: (p: MediaItem) => void;
}) {
  // react-photo-album expects Photo[] with src + width + height. We
  // attach our row through a `meta` field for the renderImage callback.
  type LocalPhoto = PhotoAlbumPhoto & { meta: MediaItem };

  const photos: LocalPhoto[] = items.map((p) => {
    const dims = dimsFor(p);
    return {
      src: thumbFor(p),
      width: dims.width,
      height: dims.height,
      alt: p.alt_vi ?? p.caption,
      meta: p,
    };
  });

  return (
    <section>
      <div className="sticky top-0 z-20 -mx-1 mb-3 bg-background/85 px-1 py-2 backdrop-blur">
        <h2 className="text-base font-semibold text-foreground">
          {year === "Không rõ năm" ? year : `Năm ${year}`}
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            ({items.length})
          </span>
        </h2>
      </div>
      <MasonryPhotoAlbum
        photos={photos}
        columns={(width) => {
          if (width < 480) return 2;
          if (width < 768) return 3;
          if (width < 1280) return 4;
          return 5;
        }}
        spacing={8}
        render={{
          image: (props, ctx) => (
            <PhotoCard
              imgProps={props}
              ctx={ctx}
              meta={(ctx.photo as LocalPhoto).meta}
              isSelected={selected.has((ctx.photo as LocalPhoto).meta.id)}
              onSelect={(id) => {
                toggleSelect(id);
              }}
              onOpen={onOpen}
            />
          ),
        }}
      />
    </section>
  );
}

function PhotoCard({
  imgProps,
  ctx,
  meta,
  isSelected,
  onSelect,
  onOpen,
}: {
  imgProps: React.ImgHTMLAttributes<HTMLImageElement>;
  ctx: RenderImageContext;
  meta: MediaItem;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onOpen: (p: MediaItem) => void;
}) {
  const isVideo = meta.kind === "video";
  const dur = durationLabel(meta.duration_seconds);
  // The library passes width/height; we apply them so the masonry layout
  // is preserved.
  return (
    <div
      className={cn(
        "group relative overflow-hidden rounded-xl border border-border bg-card transition-all",
        isSelected && "ring-2 ring-primary ring-offset-2",
      )}
      style={{ width: ctx.width, height: ctx.height }}
    >
      <button
        type="button"
        onClick={() => onOpen(meta)}
        className="block w-full h-full"
        title="Xem chi tiết"
      >
        {imgProps.src ? (
          <img
            {...imgProps}
            loading="lazy"
            className="block h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-3xl opacity-60">
            {isVideo ? "🎬" : "🖼️"}
          </div>
        )}
      </button>

      {isVideo && (
        <>
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/50 text-white shadow-lg backdrop-blur-sm">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
            </span>
          </div>
          {dur && (
            <span className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white tabular-nums">
              {dur}
            </span>
          )}
        </>
      )}

      {meta.featured && (
        <span className="pointer-events-none absolute top-2 right-2 inline-flex items-center justify-center rounded bg-yellow-50 px-1.5 py-0.5 text-[10px] font-medium text-yellow-700 ring-1 ring-yellow-200">
          <Star className="size-3 fill-current" />
        </span>
      )}

      {/* Hover overlay with quick actions */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/65 via-black/30 to-transparent p-3 opacity-0 transition-opacity group-hover:opacity-100">
        <div className="flex items-end justify-between gap-2">
          <div className="min-w-0 flex-1 text-white">
            <p className="truncate text-xs font-medium">{meta.alt_vi ?? meta.caption}</p>
            {meta.location && (
              <p className="truncate text-[10px] text-white/80">{meta.location}</p>
            )}
          </div>
          <a
            href={`/admin/media/${meta.id}`}
            onClick={(e) => e.stopPropagation()}
            className="pointer-events-auto rounded-md bg-white/90 px-2 py-1 text-[10px] font-medium text-foreground hover:bg-white"
            title="Sửa metadata"
          >
            ✎
          </a>
        </div>
      </div>

      {/* Selection checkbox — top-left, always visible-ish on hover or select */}
      <label
        className={cn(
          "absolute top-2 left-2 inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded bg-white/85 shadow-sm transition-opacity",
          isSelected ? "opacity-100" : "opacity-0 group-hover:opacity-100",
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => {
            e.stopPropagation();
            onSelect(meta.id);
          }}
          className="size-4 rounded border-input text-primary focus:ring-ring"
        />
      </label>
    </div>
  );
}

function EmptyState({
  hasFilter,
  clearAll,
  totalCount,
}: {
  hasFilter: boolean;
  clearAll: () => void;
  totalCount: number;
}) {
  if (hasFilter && totalCount > 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-16 text-center">
        <Search className="size-10 text-muted-foreground/60" />
        <h3 className="mt-4 text-base font-semibold text-foreground">Không có kết quả</h3>
        <p className="mt-1 max-w-md text-sm text-muted-foreground">
          Không có ảnh nào khớp bộ lọc. Thử bỏ một vài tag hoặc xóa toàn bộ lọc.
        </p>
        <Button variant="outline" size="sm" className="mt-4" onClick={clearAll}>
          <X className="size-4" /> Xóa tất cả lọc
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/30 px-6 py-20 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-primary/10 text-primary">
        <ImageIcon className="size-8" />
      </div>
      <h3 className="mt-4 text-lg font-semibold text-foreground">Chưa có kỷ niệm nào</h3>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">
        Bắt đầu lưu giữ những khoảnh khắc của gia tộc — ảnh thành viên, lễ giỗ, đám cưới, họp mặt.
      </p>
      <div className="mt-6 flex items-center gap-2">
        <Button asChild>
          <a href="#" data-uppy-trigger>
            + Tải ảnh / video
          </a>
        </Button>
        <Button variant="outline" asChild>
          <a href="/admin/media/new">Tạo có form đầy đủ</a>
        </Button>
      </div>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="space-y-6">
      <div className="h-32 rounded-2xl bg-muted/40 animate-pulse" />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {Array.from({ length: 10 }).map((_, i) => {
          const h = [180, 220, 260, 200, 240][i % 5];
          return <Skeleton key={i} className="rounded-xl" style={{ height: h }} />;
        })}
      </div>
    </div>
  );
}
