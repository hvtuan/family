/**
 * Admin settings page — grouped key-value editor.
 *
 * Three category cards: Site identity · Contact · Integrations · Appearance.
 * Each row carries its own description from the DB to explain what the
 * setting controls. Save fires a single POST with all changed keys
 * (server merges with the current row).
 */
import { useMemo, useState } from "react";
import { Save, RotateCcw, Eye, EyeOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/sonner";
import { cn } from "@/lib/utils";

export type SettingItem = {
  key: string;
  value: string;
  category: "site" | "contact" | "integrations" | "appearance";
  description: string | null;
  updated_at: string;
};

interface Props {
  initial: SettingItem[];
}

const CATEGORY_LABEL: Record<SettingItem["category"], { vi: string; emoji: string; tone: string }> = {
  site:         { vi: "Thông tin website",   emoji: "🏛", tone: "border-jade/30 bg-jade/5" },
  contact:      { vi: "Liên hệ",              emoji: "✉",  tone: "border-vermilion/30 bg-vermilion/5" },
  integrations: { vi: "Tích hợp & API key",   emoji: "🔌", tone: "border-gold-2/30 bg-gold-2/5" },
  appearance:   { vi: "Giao diện",            emoji: "🎨", tone: "border-line-strong bg-paper-2/40" },
};

// Settings whose value is sensitive — render as password by default
// with a toggle to reveal. Kept here (not in the DB) so the rendering
// rule travels with the component.
const SECRET_KEYS = new Set(["integrations.google_maps_api_key"]);

// Multi-line textarea instead of single-line input.
const MULTILINE_KEYS = new Set<string>([]);

export default function SettingsForm({ initial }: Props) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(initial.map((s) => [s.key, s.value])),
  );
  const [savedSnapshot, setSavedSnapshot] = useState(values);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);

  const dirty = useMemo(() => {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(values)) {
      if ((savedSnapshot[k] ?? "") !== v) out[k] = v;
    }
    return out;
  }, [values, savedSnapshot]);

  const dirtyCount = Object.keys(dirty).length;

  const grouped = useMemo(() => {
    const map = new Map<SettingItem["category"], SettingItem[]>();
    for (const s of initial) {
      if (!map.has(s.category)) map.set(s.category, []);
      map.get(s.category)!.push(s);
    }
    const order: SettingItem["category"][] = ["site", "contact", "integrations", "appearance"];
    return order.flatMap((c) => (map.has(c) ? [[c, map.get(c)!] as const] : []));
  }, [initial]);

  const onSave = async () => {
    if (dirtyCount === 0) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.set("action", "save");
      for (const [k, v] of Object.entries(dirty)) {
        fd.append(`key[]`, k);
        fd.append(`value[]`, v);
      }
      const res = await fetch("/admin/settings", { method: "POST", body: fd });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json.ok) throw new Error(json.error ?? "Lưu thất bại");
      setSavedSnapshot({ ...values });
      toast.success(`Đã lưu ${dirtyCount} thiết lập`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Lỗi mạng");
    } finally {
      setBusy(false);
    }
  };

  const onRevert = () => {
    setValues(savedSnapshot);
    toast.info("Đã hoàn tác thay đổi chưa lưu");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 shadow-theme-xs">
        <div className="text-sm text-muted-foreground">
          {dirtyCount === 0 ? (
            <>Chưa có thay đổi.</>
          ) : (
            <>
              <span className="font-medium text-foreground">{dirtyCount} thiết lập</span> chưa lưu.
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          {dirtyCount > 0 && (
            <Button variant="outline" size="sm" onClick={onRevert} disabled={busy}>
              <RotateCcw className="size-4" /> Hoàn tác
            </Button>
          )}
          <Button onClick={onSave} disabled={busy || dirtyCount === 0}>
            <Save className="size-4" /> Lưu thay đổi
          </Button>
        </div>
      </div>

      {grouped.map(([category, rows]) => {
        const meta = CATEGORY_LABEL[category];
        return (
          <section
            key={category}
            className={cn(
              "rounded-2xl border bg-card p-5 shadow-theme-xs",
              meta.tone,
            )}
          >
            <header className="mb-4 flex items-center gap-3 border-b border-border/40 pb-3">
              <span className="text-2xl" aria-hidden>{meta.emoji}</span>
              <h2 className="text-base font-semibold text-foreground">{meta.vi}</h2>
              <span className="ml-auto text-xs text-muted-foreground tabular-nums">
                {rows.length} mục
              </span>
            </header>

            <div className="space-y-4">
              {rows.map((row) => {
                const isSecret = SECRET_KEYS.has(row.key);
                const isMultiline = MULTILINE_KEYS.has(row.key);
                const isDirty = (savedSnapshot[row.key] ?? "") !== values[row.key];
                return (
                  <div key={row.key} className="grid grid-cols-1 gap-2 md:grid-cols-[1fr_2fr] md:gap-4 md:items-start">
                    <div className="space-y-0.5">
                      <Label
                        htmlFor={row.key}
                        className={cn("font-medium", isDirty && "text-vermilion")}
                      >
                        {labelFromKey(row.key)}
                        {isDirty && <span className="ml-1.5 text-[10px] uppercase tracking-wide">đã sửa</span>}
                      </Label>
                      <p className="text-xs text-muted-foreground leading-snug">
                        {row.description ?? "—"}
                      </p>
                      <p className="font-mono text-[10px] text-muted-foreground/70">{row.key}</p>
                    </div>
                    <div className="space-y-1.5">
                      {isMultiline ? (
                        <Textarea
                          id={row.key}
                          rows={3}
                          value={values[row.key] ?? ""}
                          onChange={(e) => setValues((p) => ({ ...p, [row.key]: e.target.value }))}
                          placeholder="(trống)"
                        />
                      ) : (
                        <div className="relative">
                          <Input
                            id={row.key}
                            type={isSecret && !revealed[row.key] ? "password" : "text"}
                            value={values[row.key] ?? ""}
                            onChange={(e) => setValues((p) => ({ ...p, [row.key]: e.target.value }))}
                            placeholder="(trống)"
                            className={isSecret ? "pr-10 font-mono" : undefined}
                            autoComplete="off"
                            spellCheck={false}
                          />
                          {isSecret && (
                            <button
                              type="button"
                              onClick={() =>
                                setRevealed((p) => ({ ...p, [row.key]: !p[row.key] }))
                              }
                              className="absolute right-2 top-1/2 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:bg-accent"
                              title={revealed[row.key] ? "Ẩn" : "Hiện"}
                            >
                              {revealed[row.key] ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      {/* Sticky save bar at the bottom */}
      {dirtyCount > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur-sm shadow-[0_-2px_10px_rgba(0,0,0,.04)]">
          <div className="mx-auto flex max-w-screen-2xl items-center justify-between px-6 py-3">
            <div className="text-sm text-foreground">
              <span className="font-semibold">{dirtyCount}</span> thiết lập chưa lưu
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={onRevert} disabled={busy}>
                Hoàn tác
              </Button>
              <Button onClick={onSave} disabled={busy}>
                <Save className="size-4" /> Lưu thay đổi
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Friendlier display label from a setting key. Falls back to the
 *  trailing segment of the key if no specific label is defined. */
function labelFromKey(key: string): string {
  const map: Record<string, string> = {
    "site.brand_vi": "Tên dòng họ (vi)",
    "site.brand_en": "Tên dòng họ (en)",
    "site.hometown": "Quê hương",
    "site.hometown_en": "Hometown (latin)",
    "site.motto": "Châm ngôn",
    "site.motto_en": "Motto (en)",
    "site.monogram": "Monogram / dấu ấn",
    "site.established": "Năm khởi tổ",
    "site.surname": "Họ",
    "contact.admin_email": "Email admin chính",
    "contact.admin_phone": "Điện thoại admin",
    "contact.public_url": "URL trang công khai",
    "integrations.google_maps_api_key": "Google Maps API key",
    "appearance.default_theme": "Theme mặc định",
  };
  return map[key] ?? key.split(".").pop() ?? key;
}
