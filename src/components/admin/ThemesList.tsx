/**
 * /admin/themes — list of palette cards.
 *
 * Shows each theme as a swatch + label + sample. Default theme has a
 * star badge. Admin actions: Edit (→ /admin/themes/[id]), Set default
 * (POST), Delete (POST).
 */
import { useState } from "react";
import { Star, Pencil, Trash2, Plus, Copy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

export type ThemeListItem = {
  id: string;
  label_vi: string;
  label_en: string;
  swatch: string;
  vars: Record<string, string>;
  is_default: boolean;
  sort_order: number;
};

interface Props {
  initial: ThemeListItem[];
}

export default function ThemesList({ initial }: Props) {
  const [themes, setThemes] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);

  const post = async (action: string, fields: Record<string, string>) => {
    const fd = new FormData();
    fd.set("action", action);
    for (const [k, v] of Object.entries(fields)) fd.set(k, v);
    const res = await fetch("/admin/themes", { method: "POST", body: fd });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || !json.ok) throw new Error(json.error ?? "Lỗi");
    return json;
  };

  const onSetDefault = async (id: string) => {
    setBusy(id);
    try {
      await post("set_default", { id });
      setThemes((prev) =>
        prev.map((t) => ({ ...t, is_default: t.id === id })),
      );
      toast.success("Đã đặt làm theme mặc định");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không đặt được mặc định");
    } finally {
      setBusy(null);
    }
  };

  const onDelete = async (id: string, label: string) => {
    if (!confirm(`Xóa theme "${label}"?\nThao tác không hoàn lại.`)) return;
    setBusy(id);
    try {
      await post("delete", { id });
      setThemes((prev) => prev.filter((t) => t.id !== id));
      toast.success(`Đã xóa "${label}"`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không xóa được");
    } finally {
      setBusy(null);
    }
  };

  const onClone = async (id: string) => {
    setBusy(id);
    try {
      const res = await post("clone", { id });
      window.location.href = `/admin/themes/${res.id}`;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Không clone được");
      setBusy(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-end">
        <Button asChild>
          <a href="/admin/themes/new">
            <Plus className="size-4" /> Tạo theme mới
          </a>
        </Button>
      </div>

      {themes.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center text-sm text-muted-foreground">
          Chưa có theme nào. Tạo theme đầu tiên để bắt đầu.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {themes.map((t) => (
          <ThemeCard
            key={t.id}
            theme={t}
            busy={busy === t.id}
            onSetDefault={() => onSetDefault(t.id)}
            onDelete={() => onDelete(t.id, t.label_vi)}
            onClone={() => onClone(t.id)}
          />
        ))}
      </div>
    </div>
  );
}

function ThemeCard({
  theme: t,
  busy,
  onSetDefault,
  onDelete,
  onClone,
}: {
  theme: ThemeListItem;
  busy: boolean;
  onSetDefault: () => void;
  onDelete: () => void;
  onClone: () => void;
}) {
  const palette = [
    "color-paper", "color-paper-2", "color-paper-3", "color-cream",
    "color-ink", "color-vermilion", "color-jade", "color-gold",
  ].map((k) => ({ key: k, value: t.vars[k] ?? "" })).filter((p) => p.value);

  return (
    <article
      className={cn(
        "relative overflow-hidden rounded-2xl border bg-card shadow-theme-xs transition",
        t.is_default ? "border-success-500/60 ring-1 ring-success-500/20" : "border-border",
      )}
    >
      {/* Swatch banner — uses the theme's actual paper + ink + vermilion */}
      <div
        className="relative h-28"
        style={{
          background: `linear-gradient(135deg,
            ${t.vars["color-paper"] ?? t.swatch} 0%,
            ${t.vars["color-paper-2"] ?? t.swatch} 50%,
            ${t.vars["color-paper-3"] ?? t.swatch} 100%)`,
        }}
      >
        {t.is_default && (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-success-500 px-2 py-0.5 text-xs font-semibold text-white shadow">
            <Star className="size-3 fill-current" /> Mặc định
          </span>
        )}
        <div
          className="absolute bottom-3 left-3 rounded-full px-3 py-1 text-xs font-semibold tabular-nums"
          style={{
            background: t.vars["color-vermilion"] ?? "#8b2a1f",
            color: "#faf3e0",
          }}
        >
          {t.id}
        </div>
      </div>

      <div className="space-y-3 p-4">
        <div>
          <h3 className="text-base font-semibold text-foreground">{t.label_vi}</h3>
          <p className="text-xs text-muted-foreground">{t.label_en}</p>
        </div>

        {palette.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {palette.map((p) => (
              <span
                key={p.key}
                className="size-6 rounded-md border border-black/10 ring-1 ring-white/40"
                style={{ background: p.value }}
                title={`${p.key} · ${p.value}`}
                aria-label={`${p.key} ${p.value}`}
              />
            ))}
          </div>
        )}

        <div className="flex items-center justify-between gap-2 pt-1">
          {!t.is_default ? (
            <Button
              variant="outline"
              size="sm"
              onClick={onSetDefault}
              disabled={busy}
              className="gap-1.5"
            >
              <Star className="size-3.5" /> Đặt mặc định
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground">Đang là mặc định</span>
          )}
          <div className="flex items-center gap-1">
            <Button asChild variant="ghost" size="sm">
              <a href={`/admin/themes/${t.id}`}>
                <Pencil className="size-3.5" /> Sửa
              </a>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClone}
              disabled={busy}
              title="Clone thành theme mới"
            >
              <Copy className="size-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={onDelete}
              disabled={busy || t.is_default}
              className="text-destructive hover:text-destructive"
              title={t.is_default ? "Không xóa được theme mặc định" : "Xóa"}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </article>
  );
}
