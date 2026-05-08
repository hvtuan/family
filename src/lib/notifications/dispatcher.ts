/**
 * Inline notification dispatcher. Resolves user prefs → picks channels →
 * inserts a notifications row → invokes channel adapters → updates row
 * with delivered/failed channels + next_retry_at.
 *
 * No queue lib: synchronous within the calling request. Cron handlers and
 * admin actions await this directly.
 */
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getSetting } from "@/lib/settings";
import { channelRegistry } from "@/lib/channels/registry";
import type { AppUserRow } from "@/lib/channels/types";
import type { ChannelId, EventType, NotificationRow } from "./types";
import { parsePreferences, isInQuietHours, endOfQuietWindow, resolveChannels } from "./preferences";
import { getEventDescriptor } from "./events";

const RETRY_BACKOFF_MS = [15 * 60 * 1000, 60 * 60 * 1000, 4 * 60 * 60 * 1000];

export interface DispatchInput {
  eventType: EventType;
  recipientIds: string[];
  payload: Record<string, unknown>;
  forceChannels?: ChannelId[];
}

export interface DispatchResult {
  enqueued: number;
  sentInline: number;
}

export async function dispatch(input: DispatchInput): Promise<DispatchResult> {
  const enabled = (await getSetting("notifications.enable")) ?? "true";
  if (enabled === "false") return { enqueued: 0, sentInline: 0 };

  const event = getEventDescriptor(input.eventType);
  if (!event) throw new Error(`unknown event type: ${input.eventType}`);

  let enqueued = 0;
  let sentInline = 0;

  for (const userId of input.recipientIds) {
    const user = await loadUser(userId);
    if (!user) continue;

    const prefs = parsePreferences(user.notification_preferences);
    const channels = input.forceChannels ?? resolveChannels(prefs, input.eventType);
    if (channels.length === 0) continue;

    const inQuiet = isInQuietHours(prefs, new Date(), user.timezone ?? "Asia/Ho_Chi_Minh");
    const defer = inQuiet && !event.critical;

    const row = await insertNotification({
      user_id: userId,
      event_type: input.eventType,
      payload: input.payload,
      channels_requested: channels,
      status: defer ? "pending" : "sending",
      next_retry_at: defer
        ? endOfQuietWindow(prefs, new Date(), user.timezone ?? "Asia/Ho_Chi_Minh").toISOString()
        : null,
    });

    if (defer) {
      enqueued++;
      continue;
    }

    await deliverNotification(row, user);
    sentInline++;
  }

  return { enqueued, sentInline };
}

export async function deliverNotification(
  row: NotificationRow,
  user: AppUserRow
): Promise<void> {
  const delivered: ChannelId[] = [...(row.channels_delivered ?? [])];
  const failed: ChannelId[] = [];
  const errors: string[] = [];

  // Only attempt channels that haven't yet been delivered AND aren't already
  // in this attempt's "channels_failed". Retries pass an updated row.
  const toAttempt = (row.channels_requested ?? []).filter((c) => !delivered.includes(c));

  for (const channelId of toAttempt) {
    const adapter = channelRegistry[channelId];
    if (!adapter) {
      failed.push(channelId);
      errors.push(`${channelId}: unknown_adapter`);
      continue;
    }
    if (!(await adapter.isReady())) {
      failed.push(channelId);
      errors.push(`${channelId}: not_ready`);
      continue;
    }
    if (!(await adapter.isAvailableFor(user))) {
      // Not a failure — user simply hasn't linked this channel.
      continue;
    }
    try {
      const result = await adapter.send(row, user);
      if (result.ok) delivered.push(channelId);
      else {
        failed.push(channelId);
        errors.push(`${channelId}: ${result.error ?? "send_failed"}`);
      }
    } catch (e) {
      failed.push(channelId);
      errors.push(`${channelId}: ${e instanceof Error ? e.message : "unknown"}`);
    }
  }

  const allRequested = row.channels_requested ?? [];
  const status =
    failed.length === 0 && delivered.length === allRequested.length
      ? "sent"
      : delivered.length === 0
      ? "failed"
      : "partial";

  const nextAttempt = row.attempt_count + 1;
  const nextRetryAt =
    status !== "sent" && nextAttempt < RETRY_BACKOFF_MS.length
      ? new Date(Date.now() + RETRY_BACKOFF_MS[nextAttempt]).toISOString()
      : null;

  await supabaseAdmin
    .from("notifications")
    .update({
      status,
      channels_delivered: delivered,
      channels_failed: failed,
      last_error: errors.join("; ") || null,
      sent_at: new Date().toISOString(),
      attempt_count: nextAttempt,
      next_retry_at: nextRetryAt,
    })
    .eq("id", row.id);
}

async function loadUser(userId: string): Promise<AppUserRow | null> {
  const { data, error } = await supabaseAdmin
    .from("app_users")
    .select("id, email, display_name, preferred_lang, timezone, notification_preferences")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return (data as AppUserRow | null) ?? null;
}

async function insertNotification(input: {
  user_id: string;
  event_type: EventType;
  payload: Record<string, unknown>;
  channels_requested: ChannelId[];
  status: "pending" | "sending";
  next_retry_at: string | null;
}): Promise<NotificationRow> {
  const { data, error } = await supabaseAdmin
    .from("notifications")
    .insert(input)
    .select("*")
    .single();
  if (error) throw error;
  return data as NotificationRow;
}
