/**
 * Notification system core types. See DESIGN-NOTIFICATIONS.md.
 *
 * 8 channels declared upfront so schema + UI never break when Phase 2/3
 * adapters ship. Phase 1 ships email/in_app/web_push live; the rest are
 * stubs flagged comingSoon.
 */
import { z } from "zod";

export const CHANNEL_IDS = [
  "email",
  "in_app",
  "web_push",
  "zalo",
  "telegram",
  "messenger",
  "whatsapp",
  "sms",
] as const;
export type ChannelId = (typeof CHANNEL_IDS)[number];

export const EVENT_TYPES = [
  "anniversary.t-7",
  "anniversary.t-1",
  "anniversary.today",
  "condolence.pending",
  "member.added",
  "system.welcome",
  "system.weekly_digest",
] as const;
export type EventType = (typeof EVENT_TYPES)[number];

export const ChannelPreferenceSchema = z
  .object({
    enabled: z.boolean(),
    address: z.string().nullable().optional(),
    phone: z.string().nullable().optional(),
    user_id: z.string().nullable().optional(),
    chat_id: z.string().nullable().optional(),
    username: z.string().nullable().optional(),
    psid: z.string().nullable().optional(),
  })
  .passthrough();

export const NotificationPreferencesSchema = z.object({
  channels: z.record(z.string(), ChannelPreferenceSchema),
  events: z.record(z.string(), z.array(z.string())),
  quiet_hours: z.object({
    enabled: z.boolean(),
    from: z.string(),
    to: z.string(),
  }),
});

export type NotificationPreferences = z.infer<typeof NotificationPreferencesSchema>;
export type ChannelPreference = z.infer<typeof ChannelPreferenceSchema>;

export type NotificationStatus =
  | "pending"
  | "sending"
  | "sent"
  | "partial"
  | "failed"
  | "seen";

export interface NotificationRow {
  id: number;
  user_id: string;
  event_type: EventType;
  payload: Record<string, unknown>;
  status: NotificationStatus;
  channels_requested: ChannelId[];
  channels_delivered: ChannelId[];
  channels_failed: ChannelId[];
  attempt_count: number;
  last_error: string | null;
  next_retry_at: string | null;
  created_at: string;
  sent_at: string | null;
  seen_at: string | null;
}

export function defaultPreferences(): NotificationPreferences {
  return {
    channels: {
      email: { enabled: true },
      in_app: { enabled: true },
      web_push: { enabled: false },
      zalo: { enabled: false, user_id: null, phone: null },
      telegram: { enabled: false, chat_id: null, username: null },
      messenger: { enabled: false, psid: null },
      whatsapp: { enabled: false, phone: null },
      sms: { enabled: false, phone: null },
    },
    events: {
      "anniversary.t-7": ["email", "in_app"],
      "anniversary.t-1": ["email", "in_app", "web_push", "zalo"],
      "anniversary.today": ["email", "in_app", "web_push", "zalo"],
      "condolence.pending": ["in_app"],
      "member.added": ["in_app"],
      "system.welcome": ["email", "in_app"],
    },
    quiet_hours: { enabled: false, from: "22:00", to: "07:00" },
  };
}
