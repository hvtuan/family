/**
 * /admin/themes/[id] + /admin/themes/new — palette editor.
 *
 * Variables are grouped (text / paper / gold / vermilion / jade /
 * border) and rendered as a color-picker + hex input pair each. The
 * card on the right is a live preview using the current values, so
 * admins can see immediately what their theme will look like.
 */
import { useState } from "react";
import { Save, Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

export type VarGroup = { label: string; keys: string[] };

interface Props {
  mode: "create" | "edit";
  initial: {
    id: string;
    label_vi: string;
    label_en: string;
    swatch: string;
    vars: Record<string, string>;
    is_default: boolean;
  };
  groups: VarGroup[];
  allKeys: string[];
}

const DEFAULTS: Record<string, string> = {
  "color-ink": "#1a120a",
  "color-ink-2": "#3a2a1a",
  "color-ink-3": "#5c4a33",
  "color-paper": "#f5ecd7",
  "color-paper-2": "#efe4c7",
  "color-paper-3": "#e6d9b3",
  "color-cream": "#faf3e0",
  "color-gold": "#c9a35a",
  "color-gold-2": "#a8853f",
  "color-gold-3": "#e6c885",
  "color-vermilion": "#8b2a1f",
  "color-vermilion-2": "#6b1f17",
  "color-jade": "#2f4a3a",
  "color-jade-2": "#466b54",
  "color-line": "rgba(26, 18, 10, 0.12)",
  "color-line-strong": "rgba(26, 18, 10, 0.25)",
};

const KEY_LABEL: Record<string, string> = {
  "color-ink": "Mực chính",
  "color-ink-2": "Mực phụ",
  "color-ink-3": "Mực nhạt",
  "color-paper": "Giấy nền",
  "color-paper-2": "Giấy nền phụ",
  "color-paper-3": "Giấy nền 3",
  "color-cream": "Kem (sáng nhất)",
  "color-gold": "Vàng",
  "color-gold-2": "Vàng đậm",
  "color-gold-3": "Vàng nhạt",
  "color-vermilion": "Son đỏ",
  "color-vermilion-2": "Son đỏ đậm",
  "color-jade": "Ngọc bích",
  "color-jade-2": "Ngọc bích nhạt",
  "color-line": "Đường viền",
  "color-line-strong": "Đường viền đậm",
};

export default function ThemeForm({ mode, initial, groups }: Props) {
  const [id, setId] = useState(initial.id);
  const [labelVi, setLabelVi] = useState(initial.label_vi);
  const [labelEn, setLabelEn] = useState(initial.label_en);
  const [swatch, setSwatch] = useState(initial.swatch || "#f5ecd7");
  const [vars, setVars] = useState<Record<string, string>>(initial.vars);
  const [busy, setBusy] = useState(false);

  const updateVar = (k: string, v: string) =>
    setVars((p) => ({ ...p, [k]: v }));

  const onSave = async () => {
    if (!labelVi || !labelEn) {
      toast.error("Cần nhập đủ tên VI và EN");
      return;
    }
    if (mode === "create") {
      if (!id || !/^[a-z][a-z0-9-]{0,30}$/.test(id)) {
        toast.error("ID slug không hợp lệ. Chỉ chữ thường + số + dấu gạch.");
        return;
      }
    }
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("action", mode === "create" ? "create" : "update");
      fd.set("id", id);
      fd.set("label_vi", labelVi);
      fd.set("label_en", labelEn);
      fd.set("swatch", swatch);
      fd.set("vars", JSON.stringify(vars));
      const res = await fetch("/admin/themes", { method: "POST", body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Lưu thất bại");
      toast.success(mode === "create" ? "Đã tạo theme" : "Đã lưu theme");
      if (mode === "create") {
        window.location.href = `/admin/themes/${id}`;
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Lỗi mạng");
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
      {/* ── Editor ───────────────────────────────────────────── */}
      <div className="space-y-5">
        <section className="rounded-2xl border border-border bg-card p-5 shadow-theme-xs">
          <header className="mb-4 border-b border-border/40 pb-3">
            <h2 className="text-base font-semibold text-foreground">Định danh</h2>
          </header>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <Label htmlFor="id">ID (slug)</Label>
              <Input
                id="id"
                value={id}
                onChange={(e) => setId(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                disabled={mode === "edit"}
                placeholder="vd: midnight"
                className="mt-1 font-mono"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                Dùng làm <code className="font-mono">[data-theme=&quot;…&quot;]</code>. Không đổi sau tạo.
              </p>
            </div>
            <div>
              <Label htmlFor="label_vi">Tên (VI)</Label>
              <Input id="label_vi" value={labelVi} onChange={(e) => setLabelVi(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="label_en">Tên (EN)</Label>
              <Input id="label_en" value={labelEn} onChange={(e) => setLabelEn(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label htmlFor="swatch">Màu đại diện</Label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  id="swatch"
                  type="color"
                  value={swatch}
                  onChange={(e) => setSwatch(e.target.value)}
                  className="size-10 cursor-pointer rounded border border-input"
                />
                <Input value={swatch} onChange={(e) => setSwatch(e.target.value)} className="font-mono" />
              </div>
            </div>
          </div>
        </section>

        {groups.map((g) => (
          <section key={g.label} className="rounded-2xl border border-border bg-card p-5 shadow-theme-xs">
            <header className="mb-4 border-b border-border/40 pb-3">
              <h2 className="text-base font-semibold text-foreground">{g.label}</h2>
            </header>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              {g.keys.map((k) => (
                <ColorRow
                  key={k}
                  varKey={k}
                  label={KEY_LABEL[k] ?? k}
                  value={vars[k] ?? ""}
                  fallback={DEFAULTS[k] ?? "#000000"}
                  onChange={(v) => updateVar(k, v)}
                />
              ))}
            </div>
          </section>
        ))}

        <div className="sticky bottom-0 -mx-2 flex items-center justify-between gap-2 rounded-2xl border border-border bg-background/95 p-3 shadow-[0_-2px_10px_rgba(0,0,0,.04)] backdrop-blur lg:mx-0">
          <Button variant="outline" asChild>
            <a href="/admin/themes">Hủy</a>
          </Button>
          <Button onClick={onSave} disabled={busy}>
            <Save className="size-4" /> {mode === "create" ? "Tạo theme" : "Lưu thay đổi"}
          </Button>
        </div>
      </div>

      {/* ── Live preview ─────────────────────────────────────── */}
      <aside className="lg:sticky lg:top-6 lg:self-start">
        <ThemePreview vars={vars} brandLabel={labelVi || "(chưa đặt tên)"} />
      </aside>
    </div>
  );
}

function ColorRow({
  varKey, label, value, fallback, onChange,
}: {
  varKey: string;
  label: string;
  value: string;
  fallback: string;
  onChange: (v: string) => void;
}) {
  const isHex = /^#[0-9a-fA-F]{3,8}$/.test(value);
  const colorPickerValue = isHex ? value : fallback.startsWith("#") ? fallback : "#000000";
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <Label className="text-xs">{label}</Label>
        <code className="font-mono text-[10px] text-muted-foreground">{varKey}</code>
      </div>
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={colorPickerValue}
          onChange={(e) => onChange(e.target.value)}
          className="size-9 shrink-0 cursor-pointer rounded border border-input"
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={fallback}
          className="font-mono text-xs"
        />
      </div>
    </div>
  );
}

function ThemePreview({
  vars, brandLabel,
}: {
  vars: Record<string, string>;
  brandLabel: string;
}) {
  const v = (k: string) => vars[k] || DEFAULTS[k] || "#000";
  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-theme-md">
      <div className="border-b border-border/40 bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground">
        Xem trước trực tiếp
      </div>
      <div
        className="space-y-4 p-6"
        style={{ background: v("color-paper"), color: v("color-ink") }}
      >
        <div className="flex items-center gap-3">
          <span
            className="inline-flex size-12 items-center justify-center rounded-lg border-2 font-bold"
            style={{
              borderColor: v("color-vermilion"),
              color: v("color-vermilion"),
              background: v("color-cream"),
            }}
          >
            N
          </span>
          <div>
            <p className="font-display text-lg font-bold leading-tight" style={{ color: v("color-ink") }}>
              {brandLabel}
            </p>
            <p className="text-xs uppercase tracking-wider" style={{ color: v("color-ink-3") }}>
              The Family
            </p>
          </div>
        </div>

        <p className="text-sm leading-relaxed" style={{ color: v("color-ink-2") }}>
          Cây có gốc, nước có nguồn. Con người có tổ tiên.
        </p>

        <div
          className="rounded-xl border p-4"
          style={{
            background: v("color-paper-2"),
            borderColor: v("color-line"),
          }}
        >
          <p className="font-script italic" style={{ color: v("color-jade"), fontSize: "1.5rem" }}>
            "Uống nước nhớ nguồn"
          </p>
          <p className="mt-2 text-xs" style={{ color: v("color-ink-3") }}>
            Châm ngôn dòng họ
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            className="rounded-md px-4 py-2 text-sm font-semibold"
            style={{ background: v("color-vermilion"), color: v("color-cream") }}
          >
            Xem cây gia phả
          </button>
          <button
            className="rounded-md border px-4 py-2 text-sm font-semibold"
            style={{
              borderColor: v("color-jade"),
              color: v("color-jade"),
              background: "transparent",
            }}
          >
            Tất cả thành viên
          </button>
        </div>

        <div className="flex items-center gap-2 border-t pt-3" style={{ borderColor: v("color-line") }}>
          <span className="size-3 rounded-full" style={{ background: v("color-vermilion") }} />
          <span className="size-3 rounded-full" style={{ background: v("color-jade") }} />
          <span className="size-3 rounded-full" style={{ background: v("color-gold") }} />
          <span className="text-xs" style={{ color: v("color-ink-3") }}>Bộ ba màu chính</span>
        </div>
      </div>
    </div>
  );
}
