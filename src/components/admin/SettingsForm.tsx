/**
 * Admin settings page — tabbed key-value editor.
 *
 * 13 categories presented as a left-rail tab list on lg+ screens, horizontal
 * scrollable list on smaller. Each tab has:
 *   - icon + label + per-tab dirty-count badge + filled/total stat
 *   - rich category description (purpose, when to use, related help link)
 *   - the actual settings rows (widgets driven by row.field_type)
 *
 * Save fires a single POST with all changed keys across all tabs.
 */
import { useEffect, useMemo, useState } from "react";
import { Save, RotateCcw, Eye, EyeOff, ExternalLink } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
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

interface CategoryMeta {
  vi: string;
  emoji: string;
  short: string; // 1-line description shown in tab header
  long: string;  // 2-3 sentence description shown above the rows
  tips?: string[]; // bulleted setup tips
  helpUrl?: string;
  helpLabel?: string;
}

const CATEGORY_META: Record<string, CategoryMeta> = {
  site: {
    vi: "Thông tin website",
    emoji: "🏛",
    short: "Tên dòng họ, slogan, năm khởi tổ",
    long: "Thông tin nhận diện hiển thị ở footer, hero, share preview. Tên dòng họ + năm khởi tổ + monogram là core branding — thay đổi rất hiếm.",
    tips: [
      "Giữ slogan 1 dòng cho footer đẹp",
      "Năm khởi tổ dùng cho stats 'từ năm X (N năm)' trên trang chủ",
    ],
  },
  contact: {
    vi: "Liên hệ",
    emoji: "✉",
    short: "Email + URL công khai",
    long: "Email admin nhận thông báo hệ thống. URL công khai dùng cho liên kết tuyệt đối trong email + OG image.",
  },
  social: {
    vi: "Mạng xã hội",
    emoji: "🔗",
    short: "Footer + share preview",
    long: "Liên kết tới các trang xã hội của gia phả. Hiện ở footer mọi trang công khai. Bỏ trống = ẩn icon.",
  },
  seo: {
    vi: "SEO & chia sẻ",
    emoji: "🔎",
    short: "Meta tags + OpenGraph",
    long: "Cấu hình hiển thị khi share link Facebook / Zalo / Twitter. OG image fallback cho các trang không có ảnh riêng. Indexing có thể tắt khi site còn dev.",
    tips: [
      "OG image: 1200×630px, dạng PNG/JPG, < 1MB",
      "Default description: 150-160 ký tự, tiếng Việt",
    ],
  },
  integrations: {
    vi: "Tích hợp & API key",
    emoji: "🔌",
    short: "Google Maps + 3rd party",
    long: "Khoá API cho dịch vụ ngoài. Chỉ admin nhìn thấy mục này.",
    tips: [
      "Google Maps API key cần enable: Maps JavaScript, Places, Geocoding",
      "Restrict key theo HTTP referrer = family.huynhvantuan.net để bảo mật",
    ],
    helpUrl: "https://console.cloud.google.com/apis/credentials",
    helpLabel: "Google Cloud Console",
  },
  analytics: {
    vi: "Analytics",
    emoji: "📊",
    short: "Umami / Plausible / GA",
    long: "Tracking traffic. Bỏ trống = không nhúng tracking nào (privacy-first default). Dùng Umami self-host nếu muốn full control.",
  },
  smtp: {
    vi: "SMTP gửi email",
    emoji: "📮",
    short: "Bắt buộc cho thông báo email",
    long: "Cấu hình SMTP để hệ thống gửi email cảnh báo giỗ + email digest + welcome. Không có SMTP = mọi email channel im lặng (cron vẫn chạy nhưng skip).",
    tips: [
      "Gmail App Password: 5 phút setup, miễn phí 500 email/ngày",
      "Resend (recommended cho production): 3000 email/tháng miễn phí",
      "Port 587 = STARTTLS (recommended), 465 = SSL",
    ],
    helpUrl: "/admin/help",
    helpLabel: "Hướng dẫn SMTP đầy đủ",
  },
  maps: {
    vi: "Bản đồ mặc định",
    emoji: "🗺",
    short: "Vị trí + zoom khi mở /map",
    long: "Toạ độ trung tâm + zoom mặc định cho trang Bản đồ. Set theo quê hương / nhà thờ tổ.",
  },
  hero: {
    vi: "Hero / slideshow",
    emoji: "🖼",
    short: "Trang chủ slideshow",
    long: "Cấu hình hero slideshow trên trang chủ. Quản lý ảnh/video qua /admin/hero, chiều cao + thời lượng + fallback Lotus tại đây.",
    helpUrl: "/admin/hero",
    helpLabel: "Quản lý slide",
  },
  appearance: {
    vi: "Giao diện",
    emoji: "🎨",
    short: "Theme mặc định",
    long: "Theme mặc định khi user mở site lần đầu. Quản lý palette qua /admin/themes.",
    helpUrl: "/admin/themes",
    helpLabel: "Quản lý themes",
  },
  privacy: {
    vi: "Riêng tư & UX",
    emoji: "🔒",
    short: "Toggle hiện/ẩn UI",
    long: "Cờ điều khiển hiển thị các tính năng riêng tư. Ưu tiên âm lịch = mặc định hiển thị âm lịch trước dương lịch ở các nơi có lựa chọn.",
  },
  memorial: {
    vi: "Tưởng niệm",
    emoji: "🪷",
    short: "Master switch + lịch giỗ + sổ tang",
    long: "Module tưởng niệm: trang /memorial/[id], altar tổ tiên, banner ngày giỗ, sổ tang. Master switch tắt sẽ ẩn toàn bộ module khỏi trang công khai.",
    tips: [
      "Banner trước (ngày): banner sắp giỗ chỉ hiện trong khoảng N ngày trước",
      "Cron alert csv: '7,1,0' = gửi T-7, T-1, đúng hôm giỗ",
      "Yêu cầu duyệt sổ tang: tắt = comment public ngay (không recommended)",
    ],
    helpUrl: "/admin/memorial",
    helpLabel: "Dashboard Tưởng niệm",
  },
  notifications: {
    vi: "Thông báo",
    emoji: "🔔",
    short: "Master switch + VAPID + chat channels",
    long: "Hệ thống thông báo đa kênh. 8 channels: email · in-app · web push · Telegram · Zalo · Messenger · WhatsApp · SMS. Master switch tắt sẽ chặn mọi dispatch (cron + manual).",
    tips: [
      "VAPID keys: chạy 'pnpm run notif:gen-vapid' rồi paste vào 2 ô tương ứng",
      "CRON_SECRET không nằm ở đây — đó là biến môi trường Coolify",
      "Telegram: token từ @BotFather + secret tự generate (openssl rand -hex 32)",
      "Zalo OA: token expire 90 ngày, phải refresh thủ công",
    ],
    helpUrl: "/admin/help",
    helpLabel: "Hướng dẫn cài đặt đầy đủ",
  },
};

const CATEGORY_ORDER = [
  "site", "contact", "social", "seo",
  "integrations", "analytics", "smtp",
  "maps", "hero", "appearance", "privacy",
  "memorial", "notifications",
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
  "privacy.lunar_calendar_first": "Ưu tiên âm lịch",
  "memorial.enable": "Bật module Tưởng niệm",
  "memorial.banner_days_before": "Banner trước (ngày)",
  "memorial.alert_days_before": "Cron alert (csv ngày)",
  "memorial.condolences_require_approval": "Yêu cầu duyệt sổ tang",
  "memorial.incense_rate_limit_per_hour": "Giới hạn thắp hương/giờ",
  "memorial.chime_default_on": "Bật âm thanh chuông",
  "notifications.enable": "Bật toàn hệ thống thông báo",
  "notifications.retention_days": "Số ngày giữ thông báo",
  "notifications.web_push_vapid_public": "VAPID public key",
  "notifications.web_push_vapid_private": "VAPID private key",
  "notifications.zalo_oa_token": "Zalo OA access token",
  "notifications.zalo_oa_id": "Zalo OA ID",
  "notifications.zalo_webhook_secret": "Zalo webhook secret (app_secret)",
  "notifications.telegram_bot_token": "Telegram bot token",
  "notifications.telegram_bot_username": "Telegram bot @username",
  "notifications.telegram_webhook_secret": "Telegram webhook secret",
  "notifications.messenger_page_token": "FB Messenger Page Token",
  "notifications.messenger_page_id": "FB Messenger Page ID",
  "notifications.whatsapp_token": "WhatsApp Business token",
  "notifications.whatsapp_phone_id": "WhatsApp phone ID",
  "notifications.sms_provider": "Nhà cung cấp SMS",
  "notifications.sms_api_key": "SMS API key",
};

function labelFromKey(key: string): string {
  return LABEL_OVERRIDES[key] ?? key.split(".").pop() ?? key;
}

function isImageUrl(value: string): boolean {
  return /\.(png|jpe?g|gif|webp|svg|avif)(\?.*)?$/i.test(value.trim());
}

function isFilled(value: string | null | undefined): boolean {
  if (value == null) return false;
  const trimmed = String(value).trim();
  if (!trimmed) return false;
  return trimmed !== "false" && trimmed !== "0";
}

export default function SettingsForm({ initial }: Props) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(initial.map((s) => [s.key, s.value])),
  );
  const [savedSnapshot, setSavedSnapshot] = useState(values);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);
  const [activeTab, setActiveTab] = useState<string>(() => {
    if (typeof window === "undefined") return CATEGORY_ORDER[0];
    const fromHash = window.location.hash.replace(/^#/, "");
    return CATEGORY_ORDER.includes(fromHash) ? fromHash : CATEGORY_ORDER[0];
  });

  // Persist active tab in URL hash so reload returns to same place.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.location.hash !== `#${activeTab}`) {
      history.replaceState(null, "", `#${activeTab}`);
    }
  }, [activeTab]);

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

  // Per-category dirty count (badge on tab trigger).
  const dirtyByCategory = useMemo(() => {
    const out: Record<string, number> = {};
    for (const [cat, rows] of grouped) {
      let n = 0;
      for (const row of rows) {
        if ((savedSnapshot[row.key] ?? "") !== values[row.key]) n++;
      }
      if (n > 0) out[cat] = n;
    }
    return out;
  }, [grouped, savedSnapshot, values]);

  const filledByCategory = useMemo(() => {
    const out: Record<string, { filled: number; total: number }> = {};
    for (const [cat, rows] of grouped) {
      const filled = rows.filter((r) => isFilled(values[r.key])).length;
      out[cat] = { filled, total: rows.length };
    }
    return out;
  }, [grouped, values]);

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
    <div className="pb-24">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="grid gap-6 lg:grid-cols-[260px_1fr]">
          {/* Left rail: vertical tab list on lg+, horizontal scrollable on mobile */}
          <aside className="lg:sticky lg:top-20 lg:self-start">
            <TabsList
              className="flex h-auto w-full flex-row gap-1 overflow-x-auto rounded-2xl border border-border bg-card p-2 shadow-theme-xs lg:flex-col lg:items-stretch lg:overflow-visible"
            >
              {grouped.map(([category]) => {
                const meta = CATEGORY_META[category] ?? {
                  vi: category, emoji: "•", short: "", long: "",
                };
                const dCount = dirtyByCategory[category] ?? 0;
                const stat = filledByCategory[category];
                return (
                  <TabsTrigger
                    key={category}
                    value={category}
                    className="group flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-normal data-[state=active]:bg-accent data-[state=active]:text-accent-foreground data-[state=active]:shadow-theme-xs lg:w-full lg:justify-start"
                  >
                    <span className="text-base" aria-hidden>{meta.emoji}</span>
                    <span className="flex-1 truncate">{meta.vi}</span>
                    {dCount > 0 ? (
                      <Badge variant="destructive" className="h-5 min-w-[20px] px-1.5 text-[10px]">
                        {dCount}
                      </Badge>
                    ) : stat ? (
                      <span className="hidden text-[10px] text-muted-foreground tabular-nums lg:inline">
                        {stat.filled}/{stat.total}
                      </span>
                    ) : null}
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </aside>

          {/* Right pane: active category content */}
          <div className="min-w-0">
            {grouped.map(([category, rows]) => {
              const meta = CATEGORY_META[category] ?? {
                vi: category, emoji: "•", short: "", long: "",
              };
              const stat = filledByCategory[category];
              return (
                <TabsContent key={category} value={category} className="m-0">
                  <section className="space-y-6">
                    {/* Category header */}
                    <header className="rounded-2xl border border-border bg-card p-5 shadow-theme-xs">
                      <div className="flex items-start gap-3">
                        <span className="text-3xl" aria-hidden>{meta.emoji}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-baseline gap-3">
                            <h2 className="text-lg font-semibold text-foreground m-0">{meta.vi}</h2>
                            {stat && (
                              <span className="text-xs text-muted-foreground tabular-nums">
                                {stat.filled}/{stat.total} đã điền
                              </span>
                            )}
                          </div>
                          <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                            {meta.long}
                          </p>
                          {meta.tips && meta.tips.length > 0 && (
                            <ul className="mt-3 grid gap-1.5 text-xs text-muted-foreground">
                              {meta.tips.map((t) => (
                                <li key={t} className="flex gap-2">
                                  <span aria-hidden className="text-primary">▸</span>
                                  <span>{t}</span>
                                </li>
                              ))}
                            </ul>
                          )}
                          {meta.helpUrl && (
                            <a
                              href={meta.helpUrl}
                              className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline"
                              target={meta.helpUrl.startsWith("http") ? "_blank" : undefined}
                              rel={meta.helpUrl.startsWith("http") ? "noopener noreferrer" : undefined}
                            >
                              {meta.helpLabel ?? "Mở hướng dẫn"}
                              <ExternalLink className="size-3.5" />
                            </a>
                          )}
                        </div>
                      </div>
                    </header>

                    {/* Setting rows */}
                    <div className="rounded-2xl border border-border bg-card p-5 shadow-theme-xs">
                      <div className="space-y-5">
                        {rows.map((row) => {
                          const isDirty = (savedSnapshot[row.key] ?? "") !== values[row.key];
                          return (
                            <div
                              key={row.key}
                              className="grid grid-cols-1 gap-2 border-b border-border/30 pb-5 last:border-0 last:pb-0 md:grid-cols-[minmax(220px,1fr)_2fr] md:gap-4 md:items-start"
                            >
                              <div className="space-y-0.5">
                                <Label
                                  htmlFor={row.key}
                                  className={cn("font-medium", isDirty && "text-vermilion")}
                                >
                                  {labelFromKey(row.key)}
                                  {isDirty && (
                                    <span className="ml-1.5 text-[10px] uppercase tracking-wide">
                                      đã sửa
                                    </span>
                                  )}
                                </Label>
                                <p className="text-xs text-muted-foreground leading-snug">
                                  {row.description ?? "—"}
                                </p>
                                <p className="font-mono text-[10px] text-muted-foreground/70">
                                  {row.key}
                                </p>
                              </div>
                              <div className="space-y-1.5">
                                <FieldWidget
                                  row={row}
                                  value={values[row.key] ?? ""}
                                  onChange={(v) =>
                                    setValues((p) => ({ ...p, [row.key]: v }))
                                  }
                                  revealed={!!revealed[row.key]}
                                  onToggleReveal={() =>
                                    setRevealed((p) => ({
                                      ...p,
                                      [row.key]: !p[row.key],
                                    }))
                                  }
                                />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </section>
                </TabsContent>
              );
            })}
          </div>
        </div>
      </Tabs>

      {/* Sticky save bar — bottom-aligned, respects sidebar width */}
      {dirtyCount > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur-sm shadow-[0_-2px_10px_rgba(0,0,0,.04)] lg:left-[290px]">
          <div className="mx-auto flex max-w-screen-2xl items-center justify-between px-4 py-3 md:px-6">
            <div className="text-sm text-foreground">
              <span className="font-semibold">{dirtyCount}</span> thiết lập chưa lưu
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={onRevert} disabled={busy}>
                <RotateCcw className="size-4" /> Hoàn tác
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
