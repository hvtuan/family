/**
 * Admin: /admin/hero — manage homepage slideshow.
 *
 * - Drag-and-drop reorder via @dnd-kit/sortable (vertical list).
 * - Bulk activate / deactivate at the top.
 * - Live preview pane inside the edit dialog (16:9 mock of the actual
 *   hero layout updating as the user types).
 *
 * Server endpoint /admin/hero handles POST actions (create / update /
 * toggle / delete / reorder) returning JSON. List reload via
 * /admin/hero/list.json.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Eye, EyeOff, GripVertical, Image as ImageIcon, Plus, Search,
  Trash2, X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

export type HeroSlideItem = {
  id: number;
  photo_id: string;
  sort_order: number;
  active: boolean;
  headline_vi: string | null;
  headline_en: string | null;
  cta_label: string | null;
  cta_href: string | null;
  duration_ms: number;
  photo: {
    id: string;
    kind: "image" | "video";
    src: string;
    src_thumb: string | null;
    src_medium: string | null;
    alt_vi: string | null;
    caption: string;
    duration_seconds: number | null;
  };
};

type LibraryPhoto = {
  id: string;
  kind: "image" | "video";
  src: string;
  src_thumb: string | null;
  src_medium: string | null;
  alt_vi: string | null;
  caption: string;
  year: number | null;
};

interface Props {
  initial: HeroSlideItem[];
}

export default function HeroSlidesList({ initial }: Props) {
  const [slides, setSlides] = useState(initial);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editing, setEditing] = useState<HeroSlideItem | null>(null);
  const [busy, setBusy] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const post = useCallback(async (action: string, body: Record<string, unknown>) => {
    const fd = new FormData();
    fd.set("action", action);
    for (const [k, v] of Object.entries(body)) {
      if (v != null) fd.set(k, String(v));
    }
    const res = await fetch("/admin/hero", { method: "POST", body: fd });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.ok) {
      throw new Error(json.error ?? `${action} thất bại (${res.status})`);
    }
    return json;
  }, []);

  const reload = useCallback(async () => {
    const res = await fetch("/admin/hero/list.json", { credentials: "same-origin" });
    const json = await res.json();
    if (json.ok) setSlides(json.slides);
  }, []);

  const onAdd = async (photoId: string) => {
    setBusy(true);
    try {
      await post("create", { photo_id: photoId, sort_order: slides.length, active: 1 });
      toast.success("Đã thêm slide");
      await reload();
      setPickerOpen(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Lỗi mạng");
    } finally {
      setBusy(false);
    }
  };

  const onToggle = async (s: HeroSlideItem) => {
    setBusy(true);
    try {
      await post("toggle", { id: s.id, active: s.active ? 0 : 1 });
      setSlides((prev) =>
        prev.map((x) => (x.id === s.id ? { ...x, active: !x.active } : x)),
      );
      toast.success(s.active ? "Tắt slide" : "Bật slide");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Lỗi mạng");
    } finally {
      setBusy(false);
    }
  };

  const onBulkSetActive = async (active: boolean) => {
    setBusy(true);
    try {
      const tasks = slides
        .filter((s) => s.active !== active)
        .map((s) => post("toggle", { id: s.id, active: active ? 1 : 0 }));
      await Promise.all(tasks);
      setSlides((prev) => prev.map((x) => ({ ...x, active })));
      toast.success(active ? "Đã bật tất cả slide" : "Đã tắt tất cả slide");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Lỗi mạng");
      await reload();
    } finally {
      setBusy(false);
    }
  };

  const onDelete = async (s: HeroSlideItem) => {
    if (!confirm(`Xóa slide #${s.id}?`)) return;
    setBusy(true);
    try {
      await post("delete", { id: s.id });
      setSlides((prev) => prev.filter((x) => x.id !== s.id));
      toast.success("Đã xóa");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Lỗi mạng");
    } finally {
      setBusy(false);
    }
  };

  const onDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIdx = slides.findIndex((s) => s.id === active.id);
    const newIdx = slides.findIndex((s) => s.id === over.id);
    if (oldIdx < 0 || newIdx < 0) return;
    const reordered = arrayMove(slides, oldIdx, newIdx);
    setSlides(reordered);
    setBusy(true);
    try {
      await post("reorder", { ids: reordered.map((x) => x.id).join(",") });
      toast.success("Đã đổi thứ tự");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Reorder thất bại");
      await reload();
    } finally {
      setBusy(false);
    }
  };

  const onSaveEdit = async (patch: Partial<HeroSlideItem>) => {
    if (!editing) return;
    setBusy(true);
    try {
      await post("update", {
        id: editing.id,
        headline_vi: patch.headline_vi ?? "",
        headline_en: patch.headline_en ?? "",
        cta_label: patch.cta_label ?? "",
        cta_href: patch.cta_href ?? "",
        duration_ms: patch.duration_ms ?? editing.duration_ms,
      });
      toast.success("Đã lưu");
      await reload();
      setEditing(null);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Lỗi mạng");
    } finally {
      setBusy(false);
    }
  };

  const activeCount = slides.filter((s) => s.active).length;

  return (
    <div className="space-y-6">
      {/* Header / bulk actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-muted-foreground">
          {slides.length} slide ·{" "}
          <span className="text-success-700 font-medium">{activeCount} đang bật</span>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {slides.length > 0 && activeCount < slides.length && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onBulkSetActive(true)}
              disabled={busy}
            >
              <Eye className="size-4" /> Bật tất cả
            </Button>
          )}
          {slides.length > 0 && activeCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onBulkSetActive(false)}
              disabled={busy}
            >
              <EyeOff className="size-4" /> Tắt tất cả
            </Button>
          )}
          <Button onClick={() => setPickerOpen(true)} disabled={busy}>
            <Plus className="size-4" />
            Thêm slide
          </Button>
        </div>
      </div>

      {slides.length === 0 ? (
        <EmptyState
          icon={<ImageIcon />}
          title="Chưa có slide nào"
          description="Hero homepage đang dùng layout mặc định (Lotus + brand). Thêm slide để chuyển sang slideshow ảnh / video."
          action={
            <Button onClick={() => setPickerOpen(true)}>
              <Plus className="size-4" />
              Thêm slide đầu tiên
            </Button>
          }
        />
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext
            items={slides.map((s) => s.id)}
            strategy={verticalListSortingStrategy}
          >
            <ul className="space-y-3">
              {slides.map((s, idx) => (
                <SortableSlideRow
                  key={s.id}
                  slide={s}
                  index={idx}
                  busy={busy}
                  onEdit={() => setEditing(s)}
                  onToggle={() => onToggle(s)}
                  onDelete={() => onDelete(s)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}

      {pickerOpen && (
        <PickerDialog
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          onPick={onAdd}
        />
      )}

      {editing && (
        <EditDialog
          slide={editing}
          onClose={() => setEditing(null)}
          onSave={onSaveEdit}
          busy={busy}
        />
      )}
    </div>
  );
}

// ─── Sortable row (drag handle + thumb + metadata + actions) ──────────────

function SortableSlideRow({
  slide: s,
  index,
  busy,
  onEdit,
  onToggle,
  onDelete,
}: {
  slide: HeroSlideItem;
  index: number;
  busy: boolean;
  onEdit: () => void;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: s.id });

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : undefined,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-theme-xs transition-opacity",
        !s.active && "opacity-60",
        isDragging && "shadow-theme-md",
      )}
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="flex size-8 shrink-0 cursor-grab items-center justify-center rounded text-muted-foreground hover:bg-accent active:cursor-grabbing"
        aria-label="Kéo để đổi thứ tự"
      >
        <GripVertical className="size-5" />
      </button>

      <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted font-mono text-xs font-semibold text-muted-foreground tabular-nums">
        {index + 1}
      </div>

      <div className="relative size-24 shrink-0 overflow-hidden rounded-lg border border-border bg-muted">
        {s.photo.src_thumb || s.photo.src_medium ? (
          <img
            src={s.photo.src_thumb ?? s.photo.src_medium ?? ""}
            alt={s.photo.alt_vi ?? s.photo.caption}
            className="size-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="flex size-full items-center justify-center text-2xl">
            {s.photo.kind === "video" ? "🎬" : "🖼️"}
          </div>
        )}
        {s.photo.kind === "video" && (
          <span className="absolute bottom-1 right-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
            🎬 video
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <p className="truncate font-medium text-foreground">
            {s.headline_vi ?? s.photo.alt_vi ?? s.photo.caption}
          </p>
          {s.cta_label && (
            <Badge variant="outline" className="shrink-0 text-[10px]">
              CTA: {s.cta_label}
            </Badge>
          )}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground tabular-nums">
          {s.duration_ms === 0 ? "tĩnh (không tự chuyển)" : `${s.duration_ms / 1000}s`}
          {" · "}
          <span className="font-mono">{s.photo_id}</span>
        </p>
        {s.headline_en && (
          <p className="mt-0.5 truncate text-xs italic text-muted-foreground">
            {s.headline_en}
          </p>
        )}
      </div>

      <div className="flex items-center gap-1">
        <Button variant="ghost" size="sm" onClick={onToggle} disabled={busy} title={s.active ? "Tắt" : "Bật"}>
          {s.active ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
        </Button>
        <Button variant="outline" size="sm" onClick={onEdit} disabled={busy}>
          Sửa
        </Button>
        <Button variant="destructive" size="sm" onClick={onDelete} disabled={busy} title="Xóa">
          <Trash2 className="size-4" />
        </Button>
      </div>
    </li>
  );
}

// ─── Add-slide picker (re-uses /admin/media/list.json) ─────────────────────

function PickerDialog({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (photoId: string) => void;
}) {
  const [photos, setPhotos] = useState<LibraryPhoto[] | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    fetch("/admin/media/list.json", { credentials: "same-origin" })
      .then((r) => r.json())
      .then((d) => (d.ok ? setPhotos(d.photos) : setPhotos([])))
      .catch(() => setPhotos([]));
  }, []);

  const filtered = useMemo(() => {
    if (!photos) return [];
    if (!q) return photos;
    const needle = q.toLowerCase();
    return photos.filter((p) => {
      const hay = [p.id, p.caption, p.alt_vi ?? "", String(p.year ?? "")]
        .join(" ").toLowerCase();
      return hay.includes(needle);
    });
  }, [photos, q]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Chọn ảnh / video từ thư viện</DialogTitle>
          <DialogDescription>
            Chọn 1 ảnh hoặc video để thêm vào slideshow homepage.
          </DialogDescription>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Tìm theo tên / caption / năm…"
            className="h-10 pl-9"
            autoFocus
          />
        </div>

        <div className="-mx-6 flex-1 overflow-y-auto px-6 py-2">
          {photos === null ? (
            <p className="py-8 text-center text-sm text-muted-foreground">Đang tải…</p>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Không có kết quả.
            </p>
          ) : (
            <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-5">
              {filtered.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => onPick(p.id)}
                  className="group relative overflow-hidden rounded-lg border border-border bg-muted text-left transition-shadow hover:shadow-theme-md"
                >
                  <div className="aspect-square">
                    {p.src_thumb || p.src_medium ? (
                      <img
                        src={p.src_thumb ?? p.src_medium ?? ""}
                        alt=""
                        loading="lazy"
                        className="size-full object-cover"
                      />
                    ) : (
                      <div className="flex size-full items-center justify-center text-2xl">
                        {p.kind === "video" ? "🎬" : "🖼️"}
                      </div>
                    )}
                    {p.kind === "video" && (
                      <span className="absolute top-1 right-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
                        🎬
                      </span>
                    )}
                  </div>
                  <div className="p-2">
                    <p className="truncate text-xs font-medium text-foreground">
                      {p.alt_vi ?? p.caption}
                    </p>
                    <p className="truncate text-[10px] text-muted-foreground">
                      {p.year ?? "—"}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            <X className="size-4" /> Hủy
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Edit dialog with live preview ────────────────────────────────────────

function EditDialog({
  slide,
  onClose,
  onSave,
  busy,
}: {
  slide: HeroSlideItem;
  onClose: () => void;
  onSave: (patch: Partial<HeroSlideItem>) => void;
  busy: boolean;
}) {
  const [headlineVi, setHeadlineVi] = useState(slide.headline_vi ?? "");
  const [headlineEn, setHeadlineEn] = useState(slide.headline_en ?? "");
  const [ctaLabel, setCtaLabel] = useState(slide.cta_label ?? "");
  const [ctaHref, setCtaHref] = useState(slide.cta_href ?? "");
  const [durationMs, setDurationMs] = useState(slide.duration_ms);

  // Preview values fall back to photo metadata when fields are blank,
  // matching the public renderer's resolution logic.
  const previewHeadline =
    headlineVi.trim() || slide.photo.alt_vi || slide.photo.caption;
  const previewHeadlineEn = headlineEn.trim();
  const previewCta = ctaLabel.trim();

  return (
    <Dialog open={true} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Sửa slide #{slide.id}</DialogTitle>
          <DialogDescription>
            Tùy chọn nội dung overlay. Để trống headline → tự dùng caption / alt
            của ảnh. Preview cập nhật ngay khi bạn gõ.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {/* ── Form ── */}
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="hvi">Tiêu đề (vi)</Label>
              <Input
                id="hvi"
                value={headlineVi}
                onChange={(e) => setHeadlineVi(e.target.value)}
                placeholder={slide.photo.alt_vi ?? slide.photo.caption}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hen">Tiêu đề (en)</Label>
              <Input
                id="hen"
                value={headlineEn}
                onChange={(e) => setHeadlineEn(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="cta">CTA label</Label>
                <Input
                  id="cta"
                  value={ctaLabel}
                  onChange={(e) => setCtaLabel(e.target.value)}
                  placeholder="Xem cây gia phả"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ctah">CTA URL</Label>
                <Input
                  id="ctah"
                  value={ctaHref}
                  onChange={(e) => setCtaHref(e.target.value)}
                  placeholder="/family-tree"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dur">
                Thời gian hiển thị (giây) — 0 = không tự chuyển
              </Label>
              <Input
                id="dur"
                type="number"
                min={0}
                max={60}
                value={durationMs / 1000}
                onChange={(e) => setDurationMs(Math.round(Number(e.target.value) * 1000))}
              />
            </div>
          </div>

          {/* ── Live preview pane ── */}
          <div className="space-y-1.5">
            <Label>Xem trước</Label>
            <div
              className="relative overflow-hidden rounded-lg border border-border bg-ink"
              style={{ aspectRatio: "16 / 9" }}
            >
              {slide.photo.kind === "video" ? (
                <video
                  src={slide.photo.src}
                  poster={slide.photo.src_medium ?? undefined}
                  muted
                  loop
                  playsInline
                  autoPlay
                  className="absolute inset-0 size-full object-cover"
                />
              ) : (
                <img
                  src={slide.photo.src_medium ?? slide.photo.src}
                  alt=""
                  className="absolute inset-0 size-full object-cover"
                />
              )}
              <div
                className="pointer-events-none absolute inset-0"
                style={{
                  background:
                    "linear-gradient(to bottom, transparent 35%, rgba(20,14,8,0.55) 80%, rgba(20,14,8,0.85) 100%)",
                }}
              />
              <div className="absolute inset-x-0 bottom-0 px-4 pb-4 flex flex-col gap-2">
                {previewHeadline && (
                  <p
                    className="font-display font-bold text-paper drop-shadow"
                    style={{ fontSize: "clamp(0.75rem, 2.2vw, 1.1rem)", lineHeight: 1.15 }}
                  >
                    {previewHeadline}
                  </p>
                )}
                {previewHeadlineEn && (
                  <p
                    lang="en"
                    className="italic text-paper/85 drop-shadow"
                    style={{ fontSize: "clamp(0.6rem, 1.6vw, 0.8rem)" }}
                  >
                    {previewHeadlineEn}
                  </p>
                )}
                {previewCta && (
                  <span className="self-start rounded-full bg-vermilion text-paper px-3 py-1 text-[11px] font-semibold">
                    {previewCta}
                  </span>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Tỉ lệ 16:9 thu nhỏ — layout giống hero thật trên homepage.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={busy}>
            Hủy
          </Button>
          <Button
            onClick={() =>
              onSave({
                headline_vi: headlineVi.trim() || null,
                headline_en: headlineEn.trim() || null,
                cta_label: ctaLabel.trim() || null,
                cta_href: ctaHref.trim() || null,
                duration_ms: durationMs,
              })
            }
            disabled={busy}
          >
            Lưu
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
