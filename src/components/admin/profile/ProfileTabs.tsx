import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import ProfileForm from "./ProfileForm";
import NotificationChannels from "./NotificationChannels";
import NotificationEventsMatrix from "./NotificationEventsMatrix";
import NotificationQuietHours from "./NotificationQuietHours";
import type { NotificationPreferences } from "@/lib/notifications/types";

export interface ProfileSummary {
  id: string;
  email: string;
  displayName: string;
  role: "admin" | "editor" | "branch_editor";
  preferredLang: "vi" | "en";
  avatarUrl: string | null;
  timezone: string;
}

interface Props {
  profile: ProfileSummary;
  preferences: NotificationPreferences;
}

export default function ProfileTabs({ profile, preferences }: Props) {
  return (
    <Tabs defaultValue="profile" className="w-full">
      <TabsList>
        <TabsTrigger value="profile">Hồ sơ</TabsTrigger>
        <TabsTrigger value="notifications">Thông báo</TabsTrigger>
        <TabsTrigger value="security">Bảo mật</TabsTrigger>
      </TabsList>
      <TabsContent value="profile">
        <ProfileForm profile={profile} />
      </TabsContent>
      <TabsContent value="notifications" className="space-y-6">
        <NotificationChannels profile={profile} initialPreferences={preferences} />
        <NotificationEventsMatrix initialPreferences={preferences} />
        <NotificationQuietHours initialPreferences={preferences} timezone={profile.timezone} />
      </TabsContent>
      <TabsContent value="security">
        <div className="rounded-md border p-6">
          <p className="text-sm text-gray-600 m-0">
            Đổi mật khẩu hiện làm qua chức năng riêng. Hãy liên hệ quản trị nếu bạn cần đặt lại.
          </p>
        </div>
      </TabsContent>
    </Tabs>
  );
}
