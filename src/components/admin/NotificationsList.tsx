import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

export interface NotificationItem {
  id: number;
  eventType: string;
  status: string;
  channelsRequested: string[];
  channelsDelivered: string[];
  channelsFailed: string[];
  createdAt: string;
  sentAt: string | null;
  seenAt: string | null;
  title: string;
  url: string;
}

interface Props {
  initial: NotificationItem[];
}

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return "vừa xong";
  if (ms < 3_600_000) return `${Math.floor(ms / 60_000)} phút trước`;
  if (ms < 86_400_000) return `${Math.floor(ms / 3_600_000)} giờ trước`;
  return `${Math.floor(ms / 86_400_000)} ngày trước`;
}

function statusBadge(status: string) {
  const map: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    sent:    { label: "Đã gửi",   variant: "default" },
    partial: { label: "Một phần", variant: "secondary" },
    failed:  { label: "Lỗi",       variant: "destructive" },
    pending: { label: "Chờ",       variant: "outline" },
    sending: { label: "Đang gửi",  variant: "outline" },
    seen:    { label: "Đã đọc",    variant: "secondary" },
  };
  const m = map[status] ?? { label: status, variant: "outline" as const };
  return <Badge variant={m.variant} className="text-xs">{m.label}</Badge>;
}

export default function NotificationsList({ initial }: Props) {
  const [tab, setTab] = useState<"all" | "unseen" | "sent" | "failed">("all");

  const filtered = initial.filter((n) => {
    if (tab === "unseen") return !n.seenAt;
    if (tab === "sent") return n.status === "sent";
    if (tab === "failed") return n.status === "failed";
    return true;
  });

  return (
    <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
      <TabsList>
        <TabsTrigger value="all">Tất cả</TabsTrigger>
        <TabsTrigger value="unseen">Chưa đọc</TabsTrigger>
        <TabsTrigger value="sent">Đã gửi</TabsTrigger>
        <TabsTrigger value="failed">Lỗi</TabsTrigger>
      </TabsList>
      {(["all", "unseen", "sent", "failed"] as const).map((s) => (
        <TabsContent key={s} value={s}>
          {filtered.length === 0 ? (
            <Card className="p-6 text-center text-sm text-gray-500 mt-4">Không có mục nào.</Card>
          ) : (
            <ul className="grid gap-3 list-none p-0 m-0 mt-4">
              {filtered.map((n) => (
                <li key={n.id}>
                  <Card className="p-4 flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <a href={n.url} className="font-medium text-gray-800 hover:underline">
                        {n.title}
                      </a>
                      <p className="text-xs text-gray-500 mt-1 m-0">
                        {formatRelative(n.createdAt)}
                        {n.channelsDelivered.length > 0 && (
                          <span className="ml-2">· đã gửi: {n.channelsDelivered.join(", ")}</span>
                        )}
                        {n.channelsFailed.length > 0 && (
                          <span className="ml-2 text-red-600">· lỗi: {n.channelsFailed.join(", ")}</span>
                        )}
                      </p>
                    </div>
                    {statusBadge(n.status)}
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      ))}
    </Tabs>
  );
}
