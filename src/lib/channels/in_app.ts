/**
 * In-app channel adapter. No-op send: the row in family.notifications is
 * the delivery itself. The bell icon polls /api/notifications/unread.json.
 */
import type { ChannelAdapter, AppUserRow } from "./types";
import { parsePreferences } from "@/lib/notifications/preferences";

export const inAppAdapter: ChannelAdapter = {
  id: "in_app",
  async isReady() {
    return true;
  },
  async isAvailableFor(user: AppUserRow) {
    const prefs = parsePreferences(user.notification_preferences);
    return prefs.channels.in_app?.enabled ?? true;
  },
  async send() {
    // No-op: the dispatcher already inserted the notification row; the
    // bell icon picks it up on its next poll.
    return { ok: true };
  },
};
