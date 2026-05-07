/**
 * Admin settings page — grouped key-value editor.
 *
 * Each row's widget is driven by row.field_type from the DB:
 *   text / password / textarea / number / boolean / url / color / select:a,b,c
 *
 * Save fires a single POST with all changed keys.
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
  category: string;
  description: string | null;
  field_type: string;
  sort_order: number;
  updated_at: string;
};

interface Props {
  initial: SettingItem[];
}

const CATEGORY_META: Record<string, { vi: string; emoji: string; tone: string; hint?: string }> = {
  site:         { vi: "Thông tin website",   emoji: "🏛", tone: "border-jade/30 bg-jade/5" },
  contact:      { vi: "Liên hệ",              emoji: "✉",  tone: "border-vermilion/30 bg-vermilion/5" },
  social:       { vi: "Mạng xã hội",          emoji: "🔗", tone: "border-jade/30 bg-jade/5", hint: "Hiện ở footer + share preview" },
  seo:          { vi: "SEO & chia sẻ",        emoji: "🔎", tone: "border-line-strong bg-paper-2/40", hint: "Meta tags + OpenGraph cho Facebook / Zalo" },
  integrations: { vi: "Tích hợp & API key",   emoji: "🔌", tone: "border-gold-2/30 bg-gold-2/5" },
  analytics:    { vi: "Analytics",            emoji: "📊", tone: "border-line-strong bg-paper-2/40", hint: "Bỏ trống = không nhúng tracking" },
  smtp:         { vi: "SMTP gửi email",       emoji: "📮", tone: "border-line-strong bg-paper-2/40", hint: "Chỉ cần khi bật chức năng thông báo email" },
  maps:         { vi: "Bản đồ mặc định",      emoji: "🗺", tone: "border-jade/30 bg-jade/5" },
  hero:         { vi: "Hero / slideshow",     emoji: "🖼", tone: "border-vermilion/30 bg-vermilion/5" },
  appearance:   { vi: "Giao diện",            emoji: "🎨", tone: "border-line-strong bg-paper-2/40" },
  privacy:      { vi: "Riêng tư & UX",        emoji: "🔒", tone: "border-line-strong bg-paper-2/40" },
};

const CATEGORY_ORDER = [
  "site", "contact", "social", "seo",
  "integrations", "analytics", "smtp",
  "maps", "hero", "appearance", "privacy",
];

const LABEL_OVERRIDES: Record<string, string> = {
  "site.brand_vi": "Tên dòng họ (vi)",
  "site.brand_en": "Tên dòng họ (en)",
  "site.tagline_vi": "Slogan (vi)",
  "site.tagline_en": "Slogan (en)",
  "site.hometown": "Quê hương",
  "site.hometown_en": "Hometown (latin)",
  "site.motto": "Châm ngôn",
  "site.motto_en": "Motto (en)",
  "site.monogram": "Monogram / dấu ấn",
  "site.established": "Năm khởi tổ",
  "site.surname": "Họ",
  "site.favicon_url": "Favicon URL",
  "contact.admin_email": "Email admin chính",
  "contact.admin_phone": "Điện thoại admin",
  "contact.public_url": "URL trang công khai",
  "contact.notify_emails": "Email thông báo phụ",
  "social.facebook_url": "Facebook",
  "social.youtube_url": "YouTube",
  "social.zalo_oa": "Zalo OA",
  "social.instagram_url": "Instagram",
  "seo.indexing_enabled": "Cho phép Google index",
  "seo.default_description": "Mô tả mặc định",
  "seo.og_image_url": "Ảnh share (OG image)",
  "seo.twitter_handle": "Twitter handle",
  "integrations.google_maps_api_key": "Google Maps API key",
  "analytics.umami_url": "Umami URL",
  "analytics.umami_site_id": "Umami site ID",
  "analytics.plausible_domain": "Plausible domain",
  "analytics.google_tag_id": "Google Analytics tag",
  "smtp.host": "SMTP host",
  "smtp.port": "SMTP port",
  "smtp.user": "SMTP user",
  "smtp.password": "SMTP password",
  "smtp.from_email": "From email",
  "maps.default_lat": "Vĩ độ trung tâm",
  "maps.default_lng": "Kinh độ trung tâm",
  "maps.default_zoom": "Zoom mặc định",
  "hero.default_duration_ms": "Thời lượng slide ảnh (ms)",
  "hero.show_lotus_when_empty": "Hiện hero sen khi rỗng",
  "hero.height": "Chiều cao hero",
  "appearance.default_theme": "Theme mặc định",
  "privacy.show_admin_link_in_footer": "Hiện link Admin ở footer",
  "privacy.show_theme_switcher": "Hiện nút đổi giao diện",
  "privacy.lunar_calendar_first": "Ưu tiên âm lịch",
};

function labelFromKey(key: string): string {
  return LABEL_OVERRIDES[key] ?? key.split(".").pop() ?? key;
}

function isImageUrl(value: string): boolean {
  return /\.(png|jpe?g|gif|webp|svg|avif)(\?.*)?$/i.test(value.trim());
}

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
    const map = new Map<string, SettingItem[]>();
    for (const s of initial) {
      if (!map.has(s.category)) map.set(s.category, []);
      map.get(s.category)!.push(s);
    }
    return CATEGORY_ORDER.flatMap((c) => (map.has(c) ? [[c, map.get(c)!] as const] : []));
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
    <div className="space-y-6 pb-24">
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
        const meta = CATEGORY_META[category] ?? { vi: category, emoji: "•", tone: "" };
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
              <div className="flex-1">
                <h2 className="text-base font-semibold text-foreground">{meta.vi}</h2>
                {meta.hint && <p className="text-xs text-muted-foreground">{meta.hint}</p>}
              </div>
              <span className="text-xs text-muted-foreground tabular-nums">
                {rows.length} mục
              </span>
            </header>

            <div className="space-y-4">
              {rows.map((row) => {
                const isDirty = (savedSnapshot[row.key] ?? "") !== values[row.key];
                return (
                  <div key={row.key} className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(220px,1fr)_2fr] md:gap-4 md:items-start">
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
                      <FieldWidget
                        row={row}
                        value={values[row.key] ?? ""}
                        onChange={(v) => setValues((p) => ({ ...p, [row.key]: v }))}
                        revealed={!!revealed[row.key]}
                        onToggleReveal={() =>
                          setRevealed((p) => ({ ...p, [row.key]: !p[row.key] }))
                        }
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

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

interface FieldWidgetProps {
  row: SettingItem;
  value: string;
  onChange: (v: string) => void;
  revealed: boolean;
  onToggleReveal: () => void;
}

function FieldWidget({ row, value, onChange, revealed, onToggleReveal }: FieldWidgetProps) {
  const ft = row.field_type ?? "text";

  // boolean switch — admin uses shadcn tokens (no jade), so go with
  // success-500 (clear green) for on, gray-300 for off.
  if (ft === "boolean") {
    const checked = value === "true" || value === "1" || value === "yes";
    return (
      <label className="inline-flex cursor-pointer select-none items-center gap-3">
        <span
          role="switch"
          aria-checked={checked}
          tabIndex={0}
          onClick={() => onChange(checked ? "false" : "true")}
          onKeyDown={(e) => {
            if (e.key === " " || e.key === "Enter") {
              e.preventDefault();
              onChange(checked ? "false" : "true");
            }
          }}
          className={cn(
            "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border transition-colors",
            checked
              ? "border-success-600 bg-success-500"
              : "border-gray-300 bg-gray-200",
          )}
        >
          <span
            className={cn(
              "inline-block size-5 rounded-full bg-white shadow ring-1 ring-black/5 transition-transform",
              checked ? "translate-x-5" : "translate-x-0.5",
            )}
          />
        </span>
        <span className={cn("text-sm font-medium", checked ? "text-success-700" : "text-gray-500")}>
          {checked ? "Bật" : "Tắt"}
        </span>
      </label>
    );
  }

  // select dropdown — field_type "select:opt1,opt2,opt3"
  if (ft.startsWith("select:")) {
    const opts = ft.slice("select:".length).split(",").map((s) => s.trim()).filter(Boolean);
    return (
      <select
        id={row.key}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm shadow-theme-xs focus-visible:border-primary/50 focus-visible:outline-hidden focus-visible:ring-3 focus-visible:ring-ring/20"
      >
        {opts.map((o) => (
          <option key={o} value={o}>{o}</option>
        ))}
      </select>
    );
  }

  // textarea
  if (ft === "textarea") {
    return (
      <Textarea
        id={row.key}
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="(trống)"
      />
    );
  }

  // number
  if (ft === "number") {
    return (
      <Input
        id={row.key}
        type="number"
        step="any"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="(trống)"
        className="font-mono"
      />
    );
  }

  // color
  if (ft === "color") {
    return (
      <div className="flex items-center gap-2">
        <input
          id={row.key}
          type="color"
          value={value || "#000000"}
          onChange={(e) => onChange(e.target.value)}
          className="size-10 cursor-pointer rounded border border-input bg-background"
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="#hex"
          className="font-mono"
        />
      </div>
    );
  }

  // password
  if (ft === "password") {
    return (
      <div className="relative">
        <Input
          id={row.key}
          type={revealed ? "text" : "password"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="(trống)"
          className="pr-10 font-mono"
          autoComplete="off"
          spellCheck={false}
        />
        <button
          type="button"
          onClick={onToggleReveal}
          className="absolute right-2 top-1/2 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:bg-accent"
          title={revealed ? "Ẩn" : "Hiện"}
        >
          {revealed ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
    );
  }

  // url — text input plus optional thumbnail preview when value is an image
  if (ft === "url") {
    return (
      <div className="space-y-1.5">
        <Input
          id={row.key}
          type="url"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://..."
          className="font-mono text-xs"
          autoComplete="off"
          spellCheck={false}
        />
        {value && isImageUrl(value) && (
          <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 p-2">
            <img
              src={value}
              alt=""
              className="h-12 w-20 rounded object-cover"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
            <span className="text-xs text-muted-foreground">Xem trước</span>
          </div>
        )}
        {value && !isImageUrl(value) && (
          <a
            href={value}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block text-xs text-jade underline-offset-2 hover:underline"
          >
            ↗ Mở liên kết
          </a>
        )}
      </div>
    );
  }

  // default text
  return (
    <Input
      id={row.key}
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="(trống)"
    />
  );
}
