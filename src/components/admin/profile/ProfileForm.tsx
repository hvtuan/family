import { useState } from "react";
import { toast, Toaster } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import type { ProfileSummary } from "./ProfileTabs";

interface Props {
  profile: ProfileSummary;
}

const TIMEZONES = [
  { value: "Asia/Ho_Chi_Minh", label: "Asia/Ho_Chi_Minh (UTC+7)" },
  { value: "Asia/Tokyo", label: "Asia/Tokyo (UTC+9)" },
  { value: "America/Los_Angeles", label: "America/Los_Angeles (UTC-8/-7)" },
  { value: "Europe/London", label: "Europe/London (UTC+0/+1)" },
  { value: "UTC", label: "UTC" },
];

export default function ProfileForm({ profile }: Props) {
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [timezone, setTimezone] = useState(profile.timezone);
  const [preferredLang, setPreferredLang] = useState<"vi" | "en">(profile.preferredLang);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/profile/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName, timezone, preferredLang }),
      });
      if (res.ok) toast.success("Đã lưu hồ sơ");
      else toast.error("Lỗi lưu hồ sơ");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Toaster richColors position="bottom-right" />
      <form onSubmit={onSubmit} className="grid gap-5 max-w-xl">
        <div className="grid gap-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" value={profile.email} readOnly disabled />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="displayName">Tên hiển thị</Label>
          <Input
            id="displayName"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={80}
          />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="timezone">Múi giờ</Label>
          <Select value={timezone} onValueChange={setTimezone}>
            <SelectTrigger id="timezone">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TIMEZONES.map((tz) => (
                <SelectItem key={tz.value} value={tz.value}>{tz.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="lang">Ngôn ngữ ưu tiên</Label>
          <Select value={preferredLang} onValueChange={(v) => setPreferredLang(v as "vi" | "en")}>
            <SelectTrigger id="lang">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="vi">Tiếng Việt</SelectItem>
              <SelectItem value="en">English</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button type="submit" disabled={submitting}>
          {submitting ? "Đang lưu..." : "Lưu hồ sơ"}
        </Button>
      </form>
    </>
  );
}
