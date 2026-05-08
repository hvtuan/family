import { useState, useMemo } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import type { NotificationPreferences, ChannelId } from "@/lib/notifications/types";
import { CHANNEL_IDS, EVENT_TYPES } from "@/lib/notifications/types";

const EVENT_LABELS: Record<string, string> = {
  "anniversary.t-7": "Còn 7 ngày tới giỗ",
  "anniversary.t-1": "Ngày mai là giỗ",
  "anniversary.today": "Hôm nay là giỗ",
  "condolence.pending": "Lời tưởng nhớ chờ duyệt",
  "member.added": "Thành viên mới được thêm",
  "system.welcome": "Chào mừng",
  "system.weekly_digest": "Tóm tắt tuần",
};

const CHANNEL_SHORT: Record<ChannelId, string> = {
  email: "Email", in_app: "Web", web_push: "Push",
  zalo: "Zalo", telegram: "TG", messenger: "FB", whatsapp: "WA", sms: "SMS",
};

interface Props {
  initialPreferences: NotificationPreferences;
}

export default function NotificationEventsMatrix({ initialPreferences }: Props) {
  const [prefs, setPrefs] = useState<NotificationPreferences>(initialPreferences);
  const [savingTimer, setSavingTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const enabledChannels = useMemo(
    () => CHANNEL_IDS.filter((id) => prefs.channels[id]?.enabled),
    [prefs.channels]
  );

  function isOn(eventType: string, channel: ChannelId): boolean {
    return (prefs.events[eventType] ?? []).includes(channel);
  }

  function toggle(eventType: string, channel: ChannelId, on: boolean) {
    const current = prefs.events[eventType] ?? [];
    const next = on ? Array.from(new Set([...current, channel])) : current.filter((c) => c !== channel);
    const nextPrefs: NotificationPreferences = {
      ...prefs,
      events: { ...prefs.events, [eventType]: next },
    };
    setPrefs(nextPrefs);
    scheduleSave(nextPrefs);
  }

  function scheduleSave(next: NotificationPreferences) {
    if (savingTimer) clearTimeout(savingTimer);
    const t = setTimeout(async () => {
      try {
        const res = await fetch("/api/profile/preferences", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ events: next.events }),
        });
        if (!res.ok) toast.error("Lỗi lưu ma trận thông báo");
      } catch {
        toast.error("Lỗi kết nối");
      }
    }, 600);
    setSavingTimer(t);
  }

  return (
    <Card className="p-5 overflow-x-auto">
      <h3 className="text-base font-semibold mb-3">Loại thông báo × kênh</h3>
      <p className="text-xs text-gray-500 mb-4">
        Chọn kênh nào nhận loại thông báo nào. Cột mờ = kênh chưa bật ở trên.
      </p>
      <table className="text-sm w-full">
        <thead>
          <tr className="border-b">
            <th className="text-left p-2 font-medium text-gray-600">Sự kiện</th>
            {CHANNEL_IDS.map((id) => (
              <th
                key={id}
                className={`text-center p-2 font-medium ${enabledChannels.includes(id) ? "text-gray-700" : "text-gray-300"}`}
              >
                {CHANNEL_SHORT[id]}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {EVENT_TYPES.map((eventType) => (
            <tr key={eventType} className="border-b last:border-0">
              <td className="p-2 text-gray-800">{EVENT_LABELS[eventType] ?? eventType}</td>
              {CHANNEL_IDS.map((id) => {
                const disabled = !enabledChannels.includes(id);
                return (
                  <td key={id} className="text-center p-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      disabled={disabled}
                      checked={isOn(eventType, id)}
                      onChange={(e) => toggle(eventType, id, e.target.checked)}
                    />
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
