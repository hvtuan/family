/**
 * Channel adapter interface. Every channel (email, in_app, web_push, zalo,
 * telegram, messenger, whatsapp, sms) implements this. Phase 2/3 channels
 * ship as stubs flagged comingSoon=true.
 */
import type { ChannelId, NotificationRow } from "@/lib/notifications/types";

export interface AppUserRow {
  id: string;
  email: string;
  display_name: string | null;
  preferred_lang: "vi" | "en";
  timezone: string | null;
  notification_preferences: unknown;
}

export type ChannelLinkPayload =
  | { kind: "url"; value: string }
  | { kind: "code"; value: string }
  | { kind: "deeplink"; value: string };

export interface ChannelAdapter {
  id: ChannelId;
  /** Show "Sắp ra mắt" badge in profile UI until Phase ships. */
  comingSoon?: boolean;
  /** Optional URL pointing to in-admin setup guide for this channel. */
  setupGuideUrl?: string;
  /** Globally configured (e.g. Zalo OA token set in settings)? */
  isReady(): Promise<boolean>;
  /** This specific user has linked + opted in. */
  isAvailableFor(user: AppUserRow): Promise<boolean>;
  /** Optional: per-user account linking flow. */
  beginLink?(user: AppUserRow): Promise<ChannelLinkPayload>;
  /** Verify a link attempt + persist channel state. */
  completeLink?(user: AppUserRow, payload: Record<string, unknown>): Promise<{ ok: boolean }>;
  /** Send a notification. Returns ok=true on at least one delivery. */
  send(notification: NotificationRow, user: AppUserRow): Promise<{ ok: boolean; error?: string }>;
}
