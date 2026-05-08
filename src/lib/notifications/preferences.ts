/**
 * Read / write user notification preferences. Resolves which channels
 * should fire for a given event, and computes whether the current time
 * falls in the user's quiet hours window (timezone-aware, cross-midnight).
 *
 * Lazy migration: parsePreferences accepts partial JSON and deep-merges
 * with defaults so older rows surviving schema changes still work.
 */
import {
  CHANNEL_IDS,
  defaultPreferences,
  type ChannelId,
  type NotificationPreferences,
} from "./types";

// Lazy accessor — defers supabaseAdmin initialisation until first DB call so
// pure functions (parsePreferences, resolveChannels, isInQuietHours) remain
// importable in test / edge environments without env vars.
async function db() {
  const { supabaseAdmin } = await import("../supabase/admin");
  return supabaseAdmin;
}

export function parsePreferences(input: unknown): NotificationPreferences {
  const defaults = defaultPreferences();
  if (!input || typeof input !== "object") return defaults;

  const obj = input as Partial<NotificationPreferences>;
  const channels = { ...defaults.channels };
  if (obj.channels && typeof obj.channels === "object") {
    for (const id of CHANNEL_IDS) {
      const fromInput = (obj.channels as Record<string, unknown>)[id];
      if (fromInput && typeof fromInput === "object") {
        channels[id] = { ...channels[id], ...(fromInput as Record<string, unknown>) };
      }
    }
  }

  const events = { ...defaults.events };
  if (obj.events && typeof obj.events === "object") {
    for (const [k, v] of Object.entries(obj.events)) {
      if (Array.isArray(v)) events[k] = v.filter((x): x is string => typeof x === "string");
    }
  }

  const quiet_hours = obj.quiet_hours
    ? { ...defaults.quiet_hours, ...(obj.quiet_hours as Partial<NotificationPreferences["quiet_hours"]>) }
    : defaults.quiet_hours;

  return { channels, events, quiet_hours };
}

export function resolveChannels(
  prefs: NotificationPreferences,
  eventType: string
): ChannelId[] {
  const eventChannels = prefs.events[eventType] ?? [];
  return eventChannels.filter(
    (id): id is ChannelId =>
      (CHANNEL_IDS as readonly string[]).includes(id) &&
      prefs.channels[id as ChannelId]?.enabled === true
  );
}

export function isInQuietHours(
  prefs: NotificationPreferences,
  now: Date = new Date(),
  timezone = "Asia/Ho_Chi_Minh"
): boolean {
  if (!prefs.quiet_hours.enabled) return false;
  const { from, to } = prefs.quiet_hours;
  const minutesNow = currentMinutesInTz(now, timezone);
  const fromMin = parseHHMM(from);
  const toMin = parseHHMM(to);
  if (fromMin === null || toMin === null) return false;

  if (fromMin <= toMin) {
    // Same-day window: 13:00-15:00
    return minutesNow >= fromMin && minutesNow < toMin;
  }
  // Cross-midnight window: 22:00-07:00 → in if now >= 22:00 OR now < 07:00
  return minutesNow >= fromMin || minutesNow < toMin;
}

export function endOfQuietWindow(
  prefs: NotificationPreferences,
  now: Date = new Date(),
  timezone = "Asia/Ho_Chi_Minh"
): Date {
  const toMin = parseHHMM(prefs.quiet_hours.to);
  if (toMin === null) return now;
  const minutesNow = currentMinutesInTz(now, timezone);
  const minutesUntilEnd =
    toMin > minutesNow ? toMin - minutesNow : 24 * 60 - minutesNow + toMin;
  return new Date(now.getTime() + minutesUntilEnd * 60 * 1000);
}

export async function getPreferences(userId: string): Promise<NotificationPreferences> {
  const client = await db();
  const { data, error } = await client
    .from("app_users")
    .select("notification_preferences")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return parsePreferences(data?.notification_preferences);
}

export async function updatePreferences(
  userId: string,
  patch: Partial<NotificationPreferences>
): Promise<void> {
  const current = await getPreferences(userId);
  const next: NotificationPreferences = {
    channels: { ...current.channels, ...(patch.channels ?? {}) },
    events: { ...current.events, ...(patch.events ?? {}) },
    quiet_hours: { ...current.quiet_hours, ...(patch.quiet_hours ?? {}) },
  };
  // Deep merge each channel
  if (patch.channels) {
    for (const [k, v] of Object.entries(patch.channels)) {
      next.channels[k] = { ...current.channels[k], ...v };
    }
  }
  const client = await db();
  const { error } = await client
    .from("app_users")
    .update({ notification_preferences: next })
    .eq("id", userId);
  if (error) throw error;
}

function parseHHMM(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return h * 60 + min;
}

function currentMinutesInTz(now: Date, timezone: string): number {
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const h = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const m = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return h * 60 + m;
}
