/**
 * Admin: /admin/hero — manage homepage slideshow.
 *
 * Single React island handling list + create + edit + delete + reorder.
 * Server endpoint /admin/hero accepts POST actions (save/delete/reorder
 * /toggle).
 *
 * Add slide: opens MediaPicker (kindFilter="all" — both image + video)
 * to choose a photo from the library; on pick, creates a slide pointing
 * at that photo.id.
 */
import { useEffect, useMemo, useState } from "react";
import {
  ArrowDown, ArrowUp, Eye, EyeOff, GripVertical, Image as ImageIcon,
  Plus, Search, Trash2, X,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

  const post = async (action: string, body: Record<string, unknown>) => {
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
  };

  const reload = async () => {
    const res = await fetch("/admin/hero/list.json", { credentials: "same-origin" });
    const json = await res.json();
    if (json.ok) setSlides(json.slides);
  };

  const onAdd = async (photoId: string) => {
    setBusy(true);
    try {
      await post("create", {
        photo_id: photoId,
        sort_order: slides.length,
        active: 1,
      });
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

  const onMove = async (s: HeroSlideItem, dir: -1 | 1) => {
    const idx = slides.findIndex((x) => x.id === s.id);
    const nextIdx = idx + dir;
    if (nextIdx < 0 || nextIdx >= slides.length) return;
    const reordered = [...slides];
    [reordered[idx], reordered[nextIdx]] = [reordered[nextIdx], reordered[idx]];
    setSlides(reordered);
    setBusy(true);
    try {
      await post("reorder", { ids: reordered.map((x) => x.id).join(",") });
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted-foreground">
            {slides.length} slide ·{" "}
            <span className="text-success-700 font-medium">
              {slides.filter((s) => s.active).length} đang bật
            </span>
          </p>
        </div>
        <Button onClick={() => setPickerOpen(true)} disabled={busy}>
          <Plus className="size-4" />
          Thêm slide từ thư viện
        </Button>
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
        <ul className="space-y-3">
          {slides.map((s, idx) => (
            <li
              key={s.id}
              className={cn(
                "flex items-center gap-4 rounded-2xl border border-border bg-card p-4 shadow-theme-xs transition-opacity",
                !s.active && "opacity-60",
              )}
            >
              {/* Reorder controls */}
              <div className="flex flex-col gap-1">
                <button
                  type="button"
                  onClick={() => onMove(s, -1)}
                  disabled={busy || idx === 0}
                  className="rounded p-1 text-muted-foreground hover:bg-accent disabled:opacity-30"
                  title="Lên"
                >
                  <ArrowUp className="size-4" />
                </button>
                <GripVertical className="size-4 text-muted-foreground/40 mx-auto" />
                <button
                  type="button"
                  onClick={() => onMove(s, 1)}
                  disabled={busy || idx === slides.length - 1}
                  className="rounded p-1 text-muted-foreground hover:bg-accent disabled:opacity-30"
                  title="Xuống"
                >
                  <ArrowDown className="size-4" />
                </button>
              </div>

              {/* Thumbnail */}
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
                    🎬
                  </span>
                )}
              </div>

              {/* Info */}
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
                  #{idx + 1} · {s.duration_ms / 1000}s ·{" "}
                  <span className="font-mono">{s.photo_id}</span>
                </p>
                {s.headline_en && (
                  <p className="mt-0.5 truncate text-xs italic text-muted-foreground">
                    {s.headline_en}
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onToggle(s)}
                  disabled={busy}
                  title={s.active ? "Tắt" : "Bật"}
                >
                  {s.active ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditing(s)}
                  disabled={busy}
                >
                  Sửa
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => onDelete(s)}
                  disabled={busy}
                  title="Xóa"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Add-from-library picker */}
      {pickerOpen && (
        <PickerDialog
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          onPick={onAdd}
        />
      )}

      {/* Edit dialog */}
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

// ─── Edit dialog (headline / cta / duration) ───────────────────────────────

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

  return (
    <Dialog open={true} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Sửa slide #{slide.id}</DialogTitle>
          <DialogDescription>
            Tùy chọn nội dung overlay. Để trống headline → dùng caption / alt của ảnh.
          </DialogDescription>
        </DialogHeader>

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
