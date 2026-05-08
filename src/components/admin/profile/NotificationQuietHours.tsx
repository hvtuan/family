import { useState } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { NotificationPreferences } from "@/lib/notifications/types";

interface Props {
  initialPreferences: NotificationPreferences;
  timezone: string;
}

export default function NotificationQuietHours({ initialPreferences, timezone }: Props) {
  const [enabled, setEnabled] = useState(initialPreferences.quiet_hours.enabled);
  const [from, setFrom] = useState(initialPreferences.quiet_hours.from);
  const [to, setTo] = useState(initialPreferences.quiet_hours.to);

  async function save(next: { enabled: boolean; from: string; to: string }) {
    try {
      const res = await fetch("/api/profile/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quiet_hours: next }),
      });
      if (!res.ok) toast.error("Lỗi lưu giờ yên tĩnh");
    } catch {
      toast.error("Lỗi kết nối");
    }
  }

  return (
    <Card className="p-5">
      <h3 className="text-base font-semibold mb-3">Giờ yên tĩnh</h3>
      <label className="flex items-center gap-3 mb-4">
        <input
          type="checkbox"
          className="h-5 w-5"
          checked={enabled}
          onChange={(e) => {
            setEnabled(e.target.checked);
            save({ enabled: e.target.checked, from, to });
          }}
        />
        <span className="text-sm">Bật giờ yên tĩnh — hoãn thông báo không khẩn cấp tới hết khoảng này</span>
      </label>
      <div className="grid grid-cols-2 gap-4 max-w-md">
        <div className="grid gap-1">
          <Label htmlFor="qh-from">Từ</Label>
          <Input
            id="qh-from"
            type="time"
            value={from}
            disabled={!enabled}
            onChange={(e) => {
              setFrom(e.target.value);
              save({ enabled, from: e.target.value, to });
            }}
          />
        </div>
        <div className="grid gap-1">
          <Label htmlFor="qh-to">Đến</Label>
          <Input
            id="qh-to"
            type="time"
            value={to}
            disabled={!enabled}
            onChange={(e) => {
              setTo(e.target.value);
              save({ enabled, from, to: e.target.value });
            }}
          />
        </div>
      </div>
      <p className="text-xs text-gray-500 mt-3">
        Múi giờ: <span className="font-mono">{timezone}</span> (đổi ở tab Hồ sơ).
        Thông báo "Hôm nay là ngày giỗ" được gửi ngay, không chờ.
      </p>
    </Card>
  );
}
