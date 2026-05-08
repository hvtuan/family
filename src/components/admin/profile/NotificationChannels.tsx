import { useState } from "react";
import { toast, Toaster } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { NotificationPreferences } from "@/lib/notifications/types";
import { CHANNEL_IDS } from "@/lib/notifications/types";
import type { ProfileSummary } from "./ProfileTabs";

const CHANNEL_META: Record<string, { name: string; icon: string; phaseHint: string | null }> = {
  email:     { name: "Email",                                       icon: "✉️", phaseHint: null },
  in_app:    { name: "Thông báo trong web (in-app)",                icon: "🔔", phaseHint: null },
  web_push:  { name: "Thông báo trình duyệt (web push)",            icon: "📲", phaseHint: null },
  zalo:      { name: "Zalo",                                        icon: "💬", phaseHint: "Sắp ra mắt — Phase 2" },
  telegram:  { name: "Telegram",                                    icon: "✈️",  phaseHint: "Sắp ra mắt — Phase 2" },
  messenger: { name: "Messenger",                                   icon: "📨", phaseHint: "Sắp ra mắt — Phase 3" },
  whatsapp:  { name: "WhatsApp",                                    icon: "📱", phaseHint: "Sắp ra mắt — Phase 3" },
  sms:       { name: "SMS",                                         icon: "📞", phaseHint: "Sắp ra mắt — Phase 3" },
};

interface Props {
  profile: ProfileSummary;
  initialPreferences: NotificationPreferences;
}

export default function NotificationChannels({ profile, initialPreferences }: Props) {
  const [prefs, setPrefs] = useState<NotificationPreferences>(initialPreferences);

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
                <input
                  type="checkbox"
                  className="h-5 w-5"
                  disabled={isComingSoon}
                  checked={channel?.enabled ?? false}
                  onChange={(e) => toggleChannel(id, e.target.checked)}
                />
              </li>
            );
          })}
        </ul>
      </Card>
    </>
  );
}
