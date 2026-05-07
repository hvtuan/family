/// <reference types="google.maps" />
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
import {
  AdvancedMarker, APIProvider, InfoWindow, Map as GMap, useMap,
} from "@vis.gl/react-google-maps";
import {
  Calendar, Hash, Heart, Image as ImageIcon, Map as MapIcon,
  Search, Sparkles, Star, Trash2, Users, X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

export type MemberRef = {
  id: string;
  name: string;
  gen: number;
  photo: string | null;
};

export type LocationRef = {
  id: string;
  name: string;
  name_en: string | null;
  province: string | null;
  lat: number | null;
  lng: number | null;
  is_hometown: boolean;
};

interface Props {
  items: MediaItem[];
  members?: MemberRef[];
  photoMembers?: Record<string, string[]>; // photoId → memberId[]
  locations?: LocationRef[];
  googleMapsApiKey?: string;
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

export default function MediaLibrary({
  items,
  members = [],
  photoMembers = {},
  locations = [],
  googleMapsApiKey,
  initialBanner,
}: Props) {
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

  // ── bulk featured toggle ──
  const bulkFeatured = async (value: boolean) => {
    if (selected.size === 0) return;
    setBulkBusy(true);
    const fd = new FormData();
    fd.set("action", "bulk-featured");
    fd.set("value", value ? "1" : "0");
    for (const id of selected) fd.append("ids", id);
    try {
      const res = await fetch("/admin/media", { method: "POST", body: fd });
      if (res.ok) {
        toast.success(`${value ? "Đã đánh dấu" : "Đã bỏ"} nổi bật cho ${selected.size} ảnh.`);
        setTimeout(() => location.reload(), 600);
      } else {
        toast.error(`Cập nhật thất bại (${res.status}).`);
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Lỗi mạng.");
    } finally {
      setBulkBusy(false);
    }
  };

  // ── bulk tag handler ──
  const [tagDialogOpen, setTagDialogOpen] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [tagMode, setTagMode] = useState<"add" | "remove">("add");
  const bulkTag = async () => {
    const tags = tagInput.split(",").map((t) => t.trim()).filter(Boolean);
    if (selected.size === 0 || tags.length === 0) return;
    setBulkBusy(true);
    const fd = new FormData();
    fd.set("action", "bulk-tag");
    fd.set("mode", tagMode);
    fd.set("tags", tags.join(","));
    for (const id of selected) fd.append("ids", id);
    try {
      const res = await fetch("/admin/media", { method: "POST", body: fd });
      if (res.ok) {
        const verb = tagMode === "remove" ? "Đã gỡ" : "Đã thêm";
        toast.success(`${verb} tag cho ${selected.size} ảnh.`);
        setTagDialogOpen(false);
        setTagInput("");
        setTimeout(() => location.reload(), 600);
      } else {
        toast.error(`Gắn tag thất bại (${res.status}).`);
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

  // ── tab state ──
  const [tab, setTab] = useState<"library" | "people" | "memories" | "map">(() => {
    if (typeof window === "undefined") return "library";
    const t = new URL(window.location.href).searchParams.get("tab");
    return t === "people" || t === "memories" || t === "map" ? t : "library";
  });
  const setTabAndUrl = (t: typeof tab) => {
    setTab(t);
    const u = new URL(window.location.href);
    if (t === "library") u.searchParams.delete("tab");
    else u.searchParams.set("tab", t);
    history.replaceState(null, "", u.toString());
  };

  // Pre-hydration skeleton that matches the eventual layout.
  if (!hydrated) {
    return <SkeletonGrid />;
  }

  return (
    <Tabs value={tab} onValueChange={(v) => setTabAndUrl(v as typeof tab)}>
      <TabsList className="h-auto flex-wrap">
        <TabsTrigger value="library" className="gap-1.5">
          <ImageIcon className="size-4" /> Thư viện
          <span className="ml-1 rounded-full bg-muted px-1.5 py-0 text-[10px] tabular-nums data-[state=active]:bg-primary/10">
            {items.length}
          </span>
        </TabsTrigger>
        <TabsTrigger value="people" className="gap-1.5">
          <Users className="size-4" /> Người
          <span className="ml-1 rounded-full bg-muted px-1.5 py-0 text-[10px] tabular-nums">
            {members.length}
          </span>
        </TabsTrigger>
        <TabsTrigger value="memories" className="gap-1.5">
          <Sparkles className="size-4" /> Memories
        </TabsTrigger>
        <TabsTrigger value="map" className="gap-1.5">
          <MapIcon className="size-4" /> Bản đồ
        </TabsTrigger>
      </TabsList>

      <TabsContent value="library" className="space-y-6">
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
        <LibraryEmptyState hasFilter={!!hasActiveFilter} clearAll={clearAll} totalCount={items.length} />
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

      </TabsContent>

      <TabsContent value="people">
        <PeopleTab
          members={members}
          items={items}
          photoMembers={photoMembers}
          onSelectMember={(memberId) => {
            // Switch to library + filter by linked member through tag-like
            // approach: filter rows where this member is linked.
            // Simplest UX: just jump to library + scroll grid to that member's
            // first photo. Plus set a tag-like filter via member name in q.
            setTabAndUrl("library");
            const member = members.find((m) => m.id === memberId);
            if (member) setQ(member.name.toLowerCase());
          }}
        />
      </TabsContent>

      <TabsContent value="memories">
        <MemoriesTab items={items} onOpen={(p) => {
          const idx = rows.findIndex((r) => r.id === p.id);
          if (idx >= 0) {
            setTabAndUrl("library");
            setLightboxIndex(idx);
          } else {
            // The photo is filtered out under current filters — clear and open.
            clearAll();
            setTabAndUrl("library");
            setTimeout(() => {
              const reIdx = items.findIndex((r) => r.id === p.id);
              setLightboxIndex(reIdx);
            }, 30);
          }
        }} />
      </TabsContent>

      <TabsContent value="map">
        <MapTab
          items={items}
          locations={locations}
          apiKey={googleMapsApiKey}
          onSelectLocation={(loc) => {
            setTabAndUrl("library");
            setQ(loc.toLowerCase());
          }}
        />
      </TabsContent>

      {/* Sticky bulk bar — only visible when on Library tab. */}
      {tab === "library" && selected.size > 0 && (
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
                variant="outline"
                size="sm"
                onClick={() => bulkFeatured(true)}
                disabled={bulkBusy}
                title="Đánh dấu nổi bật"
              >
                <Star className="size-4" /> Nổi bật
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setTagMode("add");
                  setTagDialogOpen(true);
                }}
                disabled={bulkBusy}
              >
                <Hash className="size-4" /> Gắn tag
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={bulkDelete}
                disabled={bulkBusy}
              >
                <Trash2 className="size-4" /> Xóa
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk tag dialog */}
      <Dialog open={tagDialogOpen} onOpenChange={setTagDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {tagMode === "add" ? "Thêm tag" : "Gỡ tag"} cho {selected.size} ảnh
            </DialogTitle>
            <DialogDescription>
              Nhập một hoặc nhiều tag, cách nhau bằng dấu phẩy. Tag tự lowercase.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="bulk-tags">Tag</Label>
              <Input
                id="bulk-tags"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                placeholder="tết, đám-cưới, 2024"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter" && tagInput.trim()) {
                    e.preventDefault();
                    bulkTag();
                  }
                }}
              />
              {tagInput && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {tagInput.split(",").map((t) => t.trim()).filter(Boolean).map((t) => (
                    <span
                      key={t}
                      className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground"
                    >
                      #{t}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-2 text-sm">
              <button
                type="button"
                onClick={() => setTagMode("add")}
                className={cn(
                  "rounded-md border px-3 py-1.5 transition-colors",
                  tagMode === "add"
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background hover:bg-accent",
                )}
              >
                Thêm vào tag hiện có
              </button>
              <button
                type="button"
                onClick={() => setTagMode("remove")}
                className={cn(
                  "rounded-md border px-3 py-1.5 transition-colors",
                  tagMode === "remove"
                    ? "border-destructive bg-destructive text-destructive-foreground"
                    : "border-border bg-background hover:bg-accent",
                )}
              >
                Gỡ khỏi tag hiện có
              </button>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setTagDialogOpen(false)} disabled={bulkBusy}>
              Hủy
            </Button>
            <Button onClick={bulkTag} disabled={bulkBusy || !tagInput.trim()}>
              {tagMode === "add" ? "Thêm tag" : "Gỡ tag"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
    </Tabs>
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

function LibraryEmptyState({
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

// ─── People tab ───────────────────────────────────────────────────────────

function PeopleTab({
  members,
  items,
  photoMembers,
  onSelectMember,
}: {
  members: MemberRef[];
  items: MediaItem[];
  photoMembers: Record<string, string[]>;
  onSelectMember: (id: string) => void;
}) {
  // Map memberId → { count, latestPhoto }
  const stats = useMemo(() => {
    const map = new Map<string, { count: number; latest: MediaItem | null }>();
    for (const m of members) map.set(m.id, { count: 0, latest: null });
    for (const p of items) {
      const linked = photoMembers[p.id] ?? [];
      for (const mid of linked) {
        const s = map.get(mid);
        if (!s) continue;
        s.count++;
        if (!s.latest || (p.year ?? 0) > (s.latest.year ?? 0)) s.latest = p;
      }
    }
    return map;
  }, [members, items, photoMembers]);

  // Group members by generation for visual structure ("Đời 1", "Đời 2", …).
  const grouped = useMemo(() => {
    const m = new Map<number, MemberRef[]>();
    for (const x of members) {
      if (!m.has(x.gen)) m.set(x.gen, []);
      m.get(x.gen)!.push(x);
    }
    return Array.from(m.entries()).sort(([a], [b]) => a - b);
  }, [members]);

  if (members.length === 0) {
    return (
      <EmptyState
        icon={<Users />}
        title="Chưa có thành viên"
        description="Thêm thành viên rồi gắn ảnh để nhóm theo người."
        action={
          <Button asChild variant="outline">
            <a href="/admin/members/new">+ Thêm thành viên</a>
          </Button>
        }
      />
    );
  }

  return (
    <div className="space-y-8">
      {grouped.map(([gen, gms]) => (
        <section key={gen}>
          <h3 className="mb-3 text-sm font-semibold text-foreground">
            Đời {gen}
            <span className="ml-2 text-xs font-normal text-muted-foreground">
              ({gms.length} người)
            </span>
          </h3>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {gms.map((m) => {
              const s = stats.get(m.id) ?? { count: 0, latest: null };
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onSelectMember(m.id)}
                  disabled={s.count === 0}
                  className="group relative overflow-hidden rounded-xl border border-border bg-card text-left transition-shadow hover:shadow-theme-md disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <div className="aspect-square bg-muted">
                    {(s.latest?.src_thumb ?? s.latest?.src_medium ?? m.photo) ? (
                      <img
                        src={s.latest?.src_thumb ?? s.latest?.src_medium ?? m.photo!}
                        alt={m.name}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-3xl text-muted-foreground/50">
                        <Users />
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <div className="truncate text-sm font-medium text-foreground">{m.name}</div>
                    <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <ImageIcon className="size-3" />
                      <span className="tabular-nums">
                        {s.count > 0 ? `${s.count} ảnh` : "chưa có ảnh"}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

// ─── Memories tab ─────────────────────────────────────────────────────────

function MemoriesTab({
  items,
  onOpen,
}: {
  items: MediaItem[];
  onOpen: (p: MediaItem) => void;
}) {
  const currentYear = new Date().getFullYear();
  // Buckets: 1, 5, 10, 20 năm trước.
  const buckets = useMemo(() => {
    const ranges = [1, 5, 10, 20];
    return ranges
      .map((n) => ({
        n,
        year: currentYear - n,
        photos: items.filter((p) => p.year === currentYear - n),
      }))
      .filter((b) => b.photos.length > 0);
  }, [items, currentYear]);

  // Featured photos = featured=true, sorted by year DESC, max 8.
  const featured = useMemo(
    () =>
      items
        .filter((p) => p.featured)
        .sort((a, b) => (b.year ?? 0) - (a.year ?? 0))
        .slice(0, 8),
    [items],
  );

  if (buckets.length === 0 && featured.length === 0) {
    return (
      <EmptyState
        icon={<Sparkles />}
        title="Chưa có Memories"
        description="Khi bạn lưu ảnh có ghi năm rõ ràng, Memories sẽ tự đào ra ảnh của các năm cùng kỳ."
      />
    );
  }

  return (
    <div className="space-y-8">
      {featured.length > 0 && (
        <section>
          <header className="mb-3 flex items-baseline justify-between">
            <h3 className="text-base font-semibold text-foreground inline-flex items-center gap-2">
              <Star className="size-4 text-yellow-500 fill-current" />
              Khoảnh khắc nổi bật
            </h3>
            <span className="text-xs text-muted-foreground">{featured.length} ảnh</span>
          </header>
          <MemoryRow photos={featured} onOpen={onOpen} />
        </section>
      )}

      {buckets.map(({ n, year, photos }) => (
        <section key={n}>
          <header className="mb-3 flex items-baseline justify-between">
            <h3 className="text-base font-semibold text-foreground inline-flex items-center gap-2">
              <Calendar className="size-4 text-primary" />
              {n} năm trước · <span className="text-muted-foreground">{year}</span>
            </h3>
            <span className="text-xs text-muted-foreground tabular-nums">
              {photos.length} ảnh
            </span>
          </header>
          <MemoryRow photos={photos} onOpen={onOpen} />
        </section>
      ))}

      <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-5 text-center text-sm text-muted-foreground">
        <Heart className="mx-auto mb-2 size-5 text-vermilion" />
        Memories sẽ phong phú hơn khi mỗi ảnh có ghi năm. Hãy bổ sung năm cho các ảnh cũ.
      </div>
    </div>
  );
}

function MemoryRow({
  photos,
  onOpen,
}: {
  photos: MediaItem[];
  onOpen: (p: MediaItem) => void;
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {photos.slice(0, 12).map((p) => {
        const thumb = p.kind === "video"
          ? (p.src_thumb || p.src_medium || "")
          : (p.src_thumb || p.src_medium || p.src);
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onOpen(p)}
            className="group relative aspect-square overflow-hidden rounded-xl border border-border bg-card transition-shadow hover:shadow-theme-md"
            title={p.alt_vi ?? p.caption}
          >
            {thumb ? (
              <img
                src={thumb}
                alt={p.alt_vi ?? p.caption}
                loading="lazy"
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-3xl opacity-60">
                {p.kind === "video" ? "🎬" : "🖼️"}
              </div>
            )}
            {p.kind === "video" && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black/50 text-white">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M8 5v14l11-7z" />
                  </svg>
                </span>
              </div>
            )}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-2 opacity-0 transition-opacity group-hover:opacity-100">
              <p className="truncate text-xs text-white">{p.caption}</p>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ─── Map tab ──────────────────────────────────────────────────────────────

function MapTab({
  items,
  locations,
  apiKey,
  onSelectLocation,
}: {
  items: MediaItem[];
  locations: LocationRef[];
  apiKey?: string;
  onSelectLocation: (location: string) => void;
}) {
  // Aggregate photos by free-text location field for the list view.
  const locationGroups = useMemo(() => {
    const map = new Map<
      string,
      { name: string; count: number; latest: MediaItem | null; videoCount: number }
    >();
    for (const p of items) {
      const loc = p.location?.trim();
      if (!loc) continue;
      const key = loc.toLowerCase();
      let entry = map.get(key);
      if (!entry) {
        entry = { name: loc, count: 0, latest: null, videoCount: 0 };
        map.set(key, entry);
      }
      entry.count++;
      if (p.kind === "video") entry.videoCount++;
      if (!entry.latest || (p.year ?? 0) > (entry.latest.year ?? 0)) {
        entry.latest = p;
      }
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [items]);

  const totalWithLocation = locationGroups.reduce((acc, l) => acc + l.count, 0);
  const totalWithoutLocation = items.length - totalWithLocation;

  if (locationGroups.length === 0 && (locations ?? []).length === 0) {
    return (
      <EmptyState
        icon={<MapIcon />}
        title="Chưa có ảnh nào ghi địa điểm"
        description="Khi bạn thêm địa điểm cho ảnh (ví dụ: Tịnh Khê, Quảng Ngãi), Bản đồ sẽ tự nhóm theo nơi chụp."
      />
    );
  }

  // Compute pins: curated locations table records that have coords +
  // at least one photo whose location text matches their name.
  const pins = useMemo(() => {
    return (locations ?? [])
      .filter((l) => typeof l.lat === "number" && typeof l.lng === "number")
      .map((l) => {
        const needle = l.name.toLowerCase();
        let count = 0;
        let latest: MediaItem | null = null;
        for (const p of items) {
          if (!p.location) continue;
          if (!p.location.toLowerCase().includes(needle)) continue;
          count++;
          if (!latest || (p.year ?? 0) > (latest.year ?? 0)) latest = p;
        }
        return { ...l, count, latest };
      })
      .filter((p) => p.count > 0)
      .sort((a, b) => b.count - a.count);
  }, [items, locations]);

  return (
    <div className="space-y-6">
      {/* Header card — Google Map when key set, decorative SVG fallback otherwise */}
      {apiKey && pins.length > 0 ? (
        <GoogleMapPanel
          apiKey={apiKey}
          pins={pins}
          totalWithLocation={totalWithLocation}
          totalWithoutLocation={totalWithoutLocation}
          locationsCount={locations.length}
          onSelectLocation={onSelectLocation}
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-jade/5 via-cream to-paper-2/40 p-5">
          <div className="flex items-center gap-4">
            <VietnamOutline className="size-24 shrink-0 text-jade" />
            <div className="flex-1 min-w-0">
              <h3 className="text-base font-semibold text-foreground">
                Kỷ niệm trên bản đồ
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                <span className="tabular-nums font-medium text-foreground">
                  {totalWithLocation}
                </span>{" "}
                ảnh ở{" "}
                <span className="tabular-nums font-medium text-foreground">
                  {locations.length}
                </span>{" "}
                địa điểm
                {totalWithoutLocation > 0 && (
                  <span className="text-muted-foreground/80">
                    {" · "}
                    {totalWithoutLocation} ảnh chưa ghi địa điểm
                  </span>
                )}
              </p>
              {!apiKey && (
                <p className="mt-2 text-xs text-muted-foreground">
                  💡 Đặt <code className="rounded bg-muted px-1 py-0.5 font-mono text-[11px]">PUBLIC_GOOGLE_MAPS_API_KEY</code>{" "}
                  để xem bản đồ Google Maps thực thay vì list này.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Location grid (always visible — uses photo.location text aggregation) */}
      <div>
        <h4 className="mb-3 text-sm font-semibold text-foreground">
          Tất cả địa điểm trong ảnh
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            ({locationGroups.length})
          </span>
        </h4>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {locationGroups.map((loc) => {
            const thumb = loc.latest
              ? loc.latest.kind === "video"
                ? (loc.latest.src_thumb || loc.latest.src_medium || "")
                : (loc.latest.src_thumb || loc.latest.src_medium || loc.latest.src)
              : "";
            return (
              <button
                key={loc.name}
                type="button"
                onClick={() => onSelectLocation(loc.name)}
                className="group flex items-stretch gap-3 overflow-hidden rounded-xl border border-border bg-card text-left transition-shadow hover:shadow-theme-md"
              >
                <div className="relative h-24 w-24 shrink-0 overflow-hidden bg-muted">
                  {thumb ? (
                    <img
                      src={thumb}
                      alt=""
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.05]"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-2xl text-muted-foreground/50">
                      <MapIcon />
                    </div>
                  )}
                </div>
                <div className="flex flex-1 flex-col justify-between p-3 min-w-0">
                  <div className="min-w-0">
                    <h4 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                      <MapIcon className="size-3.5 shrink-0 text-jade" />
                      <span className="truncate">{loc.name}</span>
                    </h4>
                    <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
                      {loc.count} ảnh
                      {loc.videoCount > 0 && ` · ${loc.videoCount} video`}
                    </p>
                  </div>
                  {loc.latest?.year && (
                    <p className="text-xs text-muted-foreground">
                      Mới nhất: <span className="text-foreground">{loc.latest.year}</span>
                    </p>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Hand-drawn approximation of Vietnam's coastline. SVG, ~40 points,
 *  inheritable color via currentColor. Decorative only. */
function VietnamOutline({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 240"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M 32 8 L 38 18 L 50 22 L 58 30 L 64 40 L 60 50 L 52 58 L 48 70 L 54 78 L 60 88 L 56 100 L 52 110 L 56 120 L 64 130 L 72 142 L 76 156 L 70 168 L 60 178 L 50 188 L 38 196 L 28 200 L 22 196 L 26 184 L 36 174 L 44 160 L 38 148 L 30 138 L 26 124 L 32 110 L 38 96 L 36 82 L 30 70 L 26 58 L 24 44 L 22 28 L 26 16 Z" />
      <circle cx="50" cy="60" r="1.5" fill="currentColor" />
      <circle cx="40" cy="170" r="1.5" fill="currentColor" />
      <circle cx="56" cy="115" r="1.5" fill="currentColor" />
    </svg>
  );
}

// ─── Google Map panel ─────────────────────────────────────────────────────

type MapPin = LocationRef & { count: number; latest: MediaItem | null };

function GoogleMapPanel({
  apiKey,
  pins,
  totalWithLocation,
  totalWithoutLocation,
  locationsCount,
  onSelectLocation,
}: {
  apiKey: string;
  pins: MapPin[];
  totalWithLocation: number;
  totalWithoutLocation: number;
  locationsCount: number;
  onSelectLocation: (name: string) => void;
}) {
  // Defer the import so SSR doesn't try to load the Google bundle.
  return (
    <DeferredAPIProvider apiKey={apiKey}>
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-theme-xs">
        <div className="border-b border-border bg-gradient-to-br from-jade/5 via-cream to-paper-2/40 p-5">
          <h3 className="text-base font-semibold text-foreground">
            Kỷ niệm trên bản đồ
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            <span className="tabular-nums font-medium text-foreground">
              {totalWithLocation}
            </span>{" "}
            ảnh ở{" "}
            <span className="tabular-nums font-medium text-foreground">
              {pins.length}
            </span>{" "}
            địa điểm có pin
            {locationsCount > pins.length && (
              <span className="text-muted-foreground/80">
                {" / "}
                {locationsCount} đã ghi
              </span>
            )}
            {totalWithoutLocation > 0 && (
              <span className="text-muted-foreground/80">
                {" · "}
                {totalWithoutLocation} ảnh chưa ghi địa điểm
              </span>
            )}
          </p>
        </div>
        <div className="h-[420px] w-full">
          <GMap
            mapId="DEMO_MAP_ID"
            defaultCenter={{ lat: 16.05, lng: 108.21 }} // Đà Nẵng — center of VN
            defaultZoom={6}
            gestureHandling="greedy"
            disableDefaultUI={false}
            mapTypeControl={false}
            streetViewControl={false}
            fullscreenControl
          >
            <MapMarkers pins={pins} onSelectLocation={onSelectLocation} />
            <FitBoundsToPins pins={pins} />
          </GMap>
        </div>
      </div>
    </DeferredAPIProvider>
  );
}

/** Wraps APIProvider — only mounts when this map is rendered, so the
 *  Google Maps script isn't loaded on pages that don't use it. */
function DeferredAPIProvider({
  apiKey,
  children,
}: {
  apiKey: string;
  children: React.ReactNode;
}) {
  return (
    <APIProvider apiKey={apiKey} libraries={["places", "marker"]} language="vi" region="VN">
      {children}
    </APIProvider>
  );
}

function MapMarkers({
  pins,
  onSelectLocation,
}: {
  pins: MapPin[];
  onSelectLocation: (name: string) => void;
}) {
  const [activeId, setActiveId] = useState<string | null>(null);
  return (
    <>
      {pins.map((p) => (
        <AdvancedMarker
          key={p.id}
          position={{ lat: p.lat!, lng: p.lng! }}
          onClick={() => setActiveId(p.id)}
        >
          <div
            className={`flex flex-col items-center ${p.is_hometown ? "text-vermilion" : "text-jade"}`}
          >
            <div className="relative">
              <svg width="32" height="40" viewBox="0 0 24 30" fill="currentColor" aria-hidden="true">
                <path d="M12 0C5.4 0 0 5.4 0 12c0 8.4 12 18 12 18s12-9.6 12-18C24 5.4 18.6 0 12 0z" />
                <circle cx="12" cy="12" r="5" fill="white" />
              </svg>
              {p.count > 0 && (
                <span className="absolute -top-1 -right-1 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground tabular-nums shadow-md">
                  {p.count}
                </span>
              )}
            </div>
          </div>
        </AdvancedMarker>
      ))}
      {activeId && (() => {
        const p = pins.find((x) => x.id === activeId);
        if (!p || p.lat == null || p.lng == null) return null;
        const thumb = p.latest
          ? p.latest.kind === "video"
            ? (p.latest.src_thumb || p.latest.src_medium || "")
            : (p.latest.src_thumb || p.latest.src_medium || p.latest.src)
          : "";
        return (
          <InfoWindow
            position={{ lat: p.lat, lng: p.lng }}
            onCloseClick={() => setActiveId(null)}
            pixelOffset={[0, -36]}
          >
            <div className="w-56">
              {thumb && (
                <img
                  src={thumb}
                  alt=""
                  className="mb-2 h-24 w-full rounded object-cover"
                  loading="lazy"
                />
              )}
              <h4 className="text-sm font-semibold text-gray-900 flex items-center gap-1.5">
                {p.is_hometown && <Star className="size-3.5 fill-current text-yellow-500" />}
                {p.name}
              </h4>
              {p.province && (
                <p className="text-xs text-gray-500">{p.province}</p>
              )}
              <p className="mt-1 text-xs text-gray-700 tabular-nums">
                {p.count} ảnh
              </p>
              <button
                type="button"
                onClick={() => {
                  setActiveId(null);
                  onSelectLocation(p.name);
                }}
                className="mt-2 inline-flex w-full items-center justify-center rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground hover:bg-brand-600"
              >
                Xem ảnh
              </button>
            </div>
          </InfoWindow>
        );
      })()}
    </>
  );
}

function FitBoundsToPins({ pins }: { pins: MapPin[] }) {
  const map = useMap();
  useEffect(() => {
    if (!map || pins.length === 0) return;
    if (pins.length === 1) {
      map.setCenter({ lat: pins[0].lat!, lng: pins[0].lng! });
      map.setZoom(12);
      return;
    }
    const bounds = new google.maps.LatLngBounds();
    for (const p of pins) {
      if (p.lat != null && p.lng != null) {
        bounds.extend({ lat: p.lat, lng: p.lng });
      }
    }
    map.fitBounds(bounds, 64);
  }, [map, pins]);
  return null;
}
