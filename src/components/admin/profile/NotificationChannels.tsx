import { useState } from "react";
import { toast, Toaster } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { NotificationPreferences } from "@/lib/notifications/types";
import { CHANNEL_IDS } from "@/lib/notifications/types";
import type { ChannelId } from "@/lib/notifications/types";
import type { ProfileSummary } from "./ProfileTabs";
import WebPushPermission from "./WebPushPermission";
import ChannelLinkDialog from "./ChannelLinkDialog";

const CHANNEL_META: Record<string, { name: string; icon: string; phaseHint: string | null; supportsLink: boolean }> = {
  email:     { name: "Email",                            icon: "✉️", phaseHint: null, supportsLink: false },
  in_app:    { name: "Thông báo trong web (in-app)",     icon: "🔔", phaseHint: null, supportsLink: false },
  web_push:  { name: "Thông báo trình duyệt (web push)", icon: "📲", phaseHint: null, supportsLink: false },
  zalo:      { name: "Zalo",                             icon: "💬", phaseHint: "Sắp ra mắt — Phase 2", supportsLink: true },
  telegram:  { name: "Telegram",                         icon: "✈️", phaseHint: null, supportsLink: true },
  messenger: { name: "Messenger",                        icon: "📨", phaseHint: "Sắp ra mắt — Phase 3", supportsLink: true },
  whatsapp:  { name: "WhatsApp",                         icon: "📱", phaseHint: "Sắp ra mắt — Phase 3", supportsLink: true },
  sms:       { name: "SMS",                              icon: "📞", phaseHint: "Sắp ra mắt — Phase 3", supportsLink: false },
};

function isLinked(channelId: ChannelId, prefs: NotificationPreferences): boolean {
  const c = prefs.channels[channelId];
  if (!c) return false;
  if (channelId === "telegram") return Boolean(c.chat_id);
  if (channelId === "zalo") return Boolean(c.user_id);
  if (channelId === "messenger") return Boolean(c.psid);
  if (channelId === "whatsapp") return Boolean(c.phone);
  if (channelId === "sms") return Boolean(c.phone);
  return false;
}

interface Props {
  profile: ProfileSummary;
  initialPreferences: NotificationPreferences;
  vapidPublicKey: string;
}

export default function NotificationChannels({ profile, initialPreferences, vapidPublicKey }: Props) {
  const [prefs, setPrefs] = useState<NotificationPreferences>(initialPreferences);
  const [linkDialogChannel, setLinkDialogChannel] = useState<ChannelId | null>(null);

  async function toggleChannel(channel: string, enabled: boolean) {
    const next: NotificationPreferences = {
      ...prefs,
      channels: { ...prefs.channels, [channel]: { ...prefs.channels[channel], enabled } },
    };
    setPrefs(next);
    try {
      const res = await fetch("/api/profile/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channels: { [channel]: { enabled } } }),
      });
      if (!res.ok) {
        toast.error("Lỗi lưu thiết lập kênh");
        setPrefs(prefs);
      }
    } catch {
      toast.error("Lỗi kết nối");
      setPrefs(prefs);
    }
  }

  async function unlink(channel: ChannelId) {
    if (!confirm(`Bạn có chắc muốn huỷ liên kết ${CHANNEL_META[channel].name}?`)) return;
    const reset: Record<string, Record<string, unknown>> = {};
    if (channel === "telegram") reset[channel] = { enabled: false, chat_id: null, username: null };
    else if (channel === "zalo") reset[channel] = { enabled: false, user_id: null, phone: null };
    else reset[channel] = { enabled: false };
    const res = await fetch("/api/profile/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ channels: reset }),
    });
    if (res.ok) {
      toast.success(`Đã huỷ liên kết ${CHANNEL_META[channel].name}`);
      window.location.reload();
    } else {
      toast.error("Lỗi huỷ liên kết");
    }
  }

  return (
    <>
      <Toaster richColors position="bottom-right" />
      <Card className="p-5">
        <h3 className="text-base font-semibold mb-4">Kênh nhận thông báo</h3>
        <ul className="grid gap-3 list-none p-0 m-0">
          {CHANNEL_IDS.map((id) => {
            const meta = CHANNEL_META[id];
            const channel = prefs.channels[id];
            const isComingSoon = Boolean(meta.phaseHint);
            const linked = isLinked(id, prefs);
            return (
              <li
                key={id}
                className="flex items-center gap-3 rounded-md border p-3"
              >
                <span aria-hidden="true" className="text-xl">{meta.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="m-0 font-medium">{meta.name}</p>
                  {id === "email" && (
                    <p className="m-0 text-xs text-gray-500">{profile.email}</p>
                  )}
                  {meta.phaseHint && (
                    <p className="m-0 text-xs text-amber-600">{meta.phaseHint}</p>
                  )}
                </div>
                {isComingSoon && (
                  <Badge variant="secondary" className="mr-2">Sắp ra mắt</Badge>
                )}
                {id === "web_push" ? (
                  <WebPushPermission vapidPublicKey={vapidPublicKey} />
                ) : meta.supportsLink && !isComingSoon ? (
                  linked ? (
                    <div className="flex items-center gap-2">
                      {channel?.username && (
                        <span className="text-xs text-gray-500">@{channel.username}</span>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => unlink(id)}
                        className="text-red-600 border-red-200 hover:bg-red-50"
                      >
                        Đã liên kết — Huỷ
                      </Button>
                      <input
                        type="checkbox"
                        className="h-5 w-5"
                        checked={channel?.enabled ?? false}
                        onChange={(e) => toggleChannel(id, e.target.checked)}
                      />
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setLinkDialogChannel(id)}
                    >
                      Liên kết tài khoản
                    </Button>
                  )
                ) : isComingSoon ? null : (
                  <input
                    type="checkbox"
                    className="h-5 w-5"
                    checked={channel?.enabled ?? false}
                    onChange={(e) => toggleChannel(id, e.target.checked)}
                  />
                )}
              </li>
            );
          })}
        </ul>
      </Card>

      {linkDialogChannel && (
        <ChannelLinkDialog
          channel={linkDialogChannel as "telegram" | "zalo" | "messenger" | "whatsapp" | "sms"}
          channelLabel={CHANNEL_META[linkDialogChannel].name}
          open={true}
          onOpenChange={(o) => { if (!o) setLinkDialogChannel(null); }}
          onLinked={() => {
            setLinkDialogChannel(null);
            window.location.reload();
          }}
        />
      )}
    </>
  );
}
