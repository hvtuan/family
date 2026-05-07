/**
 * Admin home (/admin) — single React island that lays out a hero
 * greeting, a stats grid, recent activity feed (audit log), and a
 * latest-media row. Uses shadcn primitives + lucide icons.
 */
import { useEffect, useState } from "react";
import {
  Calendar, CalendarDays, ChevronRight, Clock, Image as ImageIcon,
  Map as MapIcon, MessageSquareQuote, Plus, ScrollText, Upload, Users,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type StatItem = {
  key: string;
  label: string;
  href: string;
  count: number;
  iconKey: string;
};

type AuditEntry = {
  id: number;
  action: string;
  entity_type: string;
  entity_id: string | null;
  created_at: string;
};

type MediaItem = {
  id: string;
  kind: "image" | "video";
  src: string;
  src_thumb: string | null;
  alt_vi: string | null;
  caption: string;
  year: number | null;
};

interface Props {
  userEmail: string;
  userRole: "admin" | "editor" | "branch_editor";
  stats: StatItem[];
  pendingUsers: number | null;
  recentAudit: AuditEntry[];
  recentMedia: MediaItem[];
}

const ICONS: Record<string, React.ElementType> = {
  users: Users,
  calendar: Calendar,
  scroll: ScrollText,
  image: ImageIcon,
  quote: MessageSquareQuote,
  calendarDays: CalendarDays,
  map: MapIcon,
};

const ENTITY_LABEL: Record<string, string> = {
  members: "Thành viên",
  timeline: "Niên đại",
  traditions: "Truyền thống",
  photos: "Ảnh",
  quotes: "Câu nói",
  dates: "Ngày lễ",
  locations: "Địa điểm",
  app_users: "Người dùng",
};

const ENTITY_HREF: Record<string, string> = {
  members: "/admin/members",
  timeline: "/admin/timeline",
  traditions: "/admin/traditions",
  photos: "/admin/media",
  quotes: "/admin/quotes",
  dates: "/admin/dates",
  locations: "/admin/locations",
  app_users: "/admin/users",
};

const ACTION_LABEL: Record<string, string> = {
  insert: "thêm",
  update: "sửa",
  delete: "xóa",
};

const ACTION_VARIANT: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  insert: "default",
  update: "secondary",
  delete: "destructive",
};

function absoluteDate(iso: string): string {
  // Stable across SSR/CSR — same input → same output regardless of clock.
  return new Date(iso).toLocaleDateString("vi-VN");
}

function timeAgo(iso: string, now: number): string {
  const then = new Date(iso).getTime();
  const diff = Math.max(0, Math.floor((now - then) / 1000));
  if (diff < 60) return "vừa xong";
  if (diff < 3600) return `${Math.floor(diff / 60)} phút trước`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} giờ trước`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)} ngày trước`;
  return absoluteDate(iso);
}

export default function DashboardHero({
  userEmail,
  userRole,
  stats,
  pendingUsers,
  recentAudit,
  recentMedia,
}: Props) {
  const isAdmin = userRole === "admin";
  // Greeting + relative timestamps depend on the client's clock, so they
  // can mismatch the SSR-rendered HTML. Defer them to post-mount to keep
  // hydration deterministic.
  const [now, setNow] = useState<number | null>(null);
  const [greeting, setGreeting] = useState("Xin chào");
  useEffect(() => {
    setNow(Date.now());
    const h = new Date().getHours();
    setGreeting(h < 12 ? "Chào buổi sáng" : h < 18 ? "Chào buổi chiều" : "Chào buổi tối");
  }, []);
  const initial = (userEmail[0] ?? "?").toUpperCase();

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="rounded-2xl border border-border bg-gradient-to-br from-primary/5 via-cream/40 to-paper-2/30 p-6">
        <div className="flex items-center gap-4">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-lg font-semibold shadow-theme-md">
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm text-muted-foreground">{greeting},</p>
            <h1 className="truncate text-xl font-semibold text-foreground">
              {userEmail.split("@")[0]}
            </h1>
            <p className="text-xs text-muted-foreground">
              Quản trị gia phả họ Nguyễn ·{" "}
              <a
                href="https://family.huynhvantuan.net"
                target="_blank"
                rel="noreferrer"
                className="text-primary hover:underline"
              >
                xem trang công khai ↗
              </a>
            </p>
          </div>
          <div className="hidden md:flex flex-col items-end gap-1">
            <QuickAction href="/admin/media" icon={<Upload />}>
              Tải ảnh / video
            </QuickAction>
            <QuickAction href="/admin/members/new" icon={<Plus />}>
              Thêm thành viên
            </QuickAction>
          </div>
        </div>

        {pendingUsers != null && pendingUsers > 0 && (
          <a
            href="/admin/users"
            className="mt-4 flex items-center justify-between rounded-xl border border-warning-100 bg-warning-50 p-3 text-sm transition-colors hover:bg-warning-100"
          >
            <div className="flex items-center gap-2">
              <Clock className="size-4 text-warning-600" />
              <span className="text-warning-700">
                Có <span className="font-semibold">{pendingUsers}</span> người
                dùng đang chờ duyệt
              </span>
            </div>
            <ChevronRight className="size-4 text-warning-600" />
          </a>
        )}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {stats.map((s) => {
          const Icon = ICONS[s.iconKey] ?? ScrollText;
          return (
            <a
              key={s.key}
              href={s.href}
              className="group rounded-2xl border border-border bg-card p-4 transition-shadow hover:shadow-theme-md"
            >
              <div className="flex items-start justify-between">
                <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-colors group-hover:bg-primary/15">
                  <Icon className="size-5" />
                </div>
                <ChevronRight className="size-4 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
              </div>
              <h3 className="mt-3 text-2xl font-semibold tabular-nums text-foreground">
                {s.count.toLocaleString("vi-VN")}
              </h3>
              <p className="mt-0.5 text-sm text-muted-foreground">{s.label}</p>
            </a>
          );
        })}
      </div>

      {/* Recent media + activity */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Recent media (2 cols) */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Mới tải lên</CardTitle>
            <a
              href="/admin/media"
              className="text-xs text-primary hover:underline inline-flex items-center gap-1"
            >
              Xem tất cả <ChevronRight className="size-3" />
            </a>
          </CardHeader>
          <CardContent>
            {recentMedia.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Chưa có ảnh nào.{" "}
                <a href="/admin/media" className="text-primary hover:underline">
                  Tải lên ngay
                </a>
                .
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {recentMedia.map((m) => {
                  const thumb = m.kind === "video"
                    ? m.src_thumb
                    : (m.src_thumb ?? m.src);
                  return (
                    <a
                      key={m.id}
                      href={`/admin/media/${m.id}`}
                      className="group relative aspect-square overflow-hidden rounded-lg border border-border bg-muted"
                      title={m.alt_vi ?? m.caption}
                    >
                      {thumb ? (
                        <img
                          src={thumb}
                          alt={m.alt_vi ?? m.caption}
                          loading="lazy"
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.05]"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-3xl opacity-50">
                          {m.kind === "video" ? "🎬" : "🖼️"}
                        </div>
                      )}
                      {m.kind === "video" && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                          <span className="flex size-8 items-center justify-center rounded-full bg-black/60 text-white">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                              <path d="M8 5v14l11-7z" />
                            </svg>
                          </span>
                        </div>
                      )}
                    </a>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent activity */}
        <Card>
          <CardHeader className="flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base">Hoạt động gần đây</CardTitle>
            {isAdmin && (
              <a
                href="/admin/audit"
                className="text-xs text-primary hover:underline inline-flex items-center gap-1"
              >
                Nhật ký <ChevronRight className="size-3" />
              </a>
            )}
          </CardHeader>
          <CardContent>
            {recentAudit.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Chưa có hoạt động nào.
              </p>
            ) : (
              <ul className="space-y-2.5">
                {recentAudit.map((e) => {
                  const variant = ACTION_VARIANT[e.action] ?? "outline";
                  const action = ACTION_LABEL[e.action] ?? e.action;
                  const entity = ENTITY_LABEL[e.entity_type] ?? e.entity_type;
                  const href = ENTITY_HREF[e.entity_type] && e.entity_id
                    ? `${ENTITY_HREF[e.entity_type]}/${e.entity_id}`
                    : ENTITY_HREF[e.entity_type] ?? "#";
                  return (
                    <li
                      key={e.id}
                      className="flex items-start justify-between gap-2"
                    >
                      <div className="flex flex-1 items-center gap-2 min-w-0">
                        <Badge
                          variant={variant}
                          className={cn(
                            "shrink-0 text-[10px] font-normal",
                            variant === "default" && "bg-success-50 text-success-700 hover:bg-success-50",
                          )}
                        >
                          {action}
                        </Badge>
                        <a
                          href={href}
                          className="min-w-0 flex-1 text-sm text-foreground hover:text-primary"
                        >
                          <span className="text-muted-foreground">{entity}</span>
                          {e.entity_id && (
                            <span className="ml-1 font-mono text-xs text-muted-foreground">
                              {e.entity_id.length > 24
                                ? `${e.entity_id.slice(0, 24)}…`
                                : e.entity_id}
                            </span>
                          )}
                        </a>
                      </div>
                      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                        {now === null ? absoluteDate(e.created_at) : timeAgo(e.created_at, now)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function QuickAction({
  href,
  icon,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Button variant="outline" size="sm" asChild className="bg-background/80 backdrop-blur-sm">
      <a href={href} className="gap-1.5">
        {icon}
        {children}
      </a>
    </Button>
  );
}
