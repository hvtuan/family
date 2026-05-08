/**
 * Web Push channel adapter using the web-push lib (VAPID).
 *
 * One user → many subscriptions (per-device). On 410 Gone we cleanup the
 * stale subscription so it's not retried forever.
 */
import webpush from "web-push";
import type { ChannelAdapter, AppUserRow } from "./types";
import type { NotificationRow } from "@/lib/notifications/types";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { getSetting } from "@/lib/settings";
import { parsePreferences } from "@/lib/notifications/preferences";
import { renderEventForChannel, getEventDescriptor } from "@/lib/notifications/events";

interface PushSub {
  id: number;
  endpoint: string;
  p256dh: string;
  auth: string;
}

let vapidConfigured = false;

async function ensureVapid(): Promise<boolean> {
  if (vapidConfigured) return true;
  const [pub, priv, fromEmail] = await Promise.all([
    getSetting("notifications.web_push_vapid_public"),
    getSetting("notifications.web_push_vapid_private"),
    getSetting("smtp.from_email"),
  ]);
  if (!pub || !priv) return false;
  webpush.setVapidDetails(`mailto:${fromEmail ?? "noreply@localhost"}`, pub, priv);
  vapidConfigured = true;
  return true;
}

async function getSubscriptions(userId: string): Promise<PushSub[]> {
  const { data, error } = await supabaseAdmin
    .from("web_push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId);
  if (error) throw error;
  return (data ?? []) as PushSub[];
}

async function deleteSubscription(id: number): Promise<void> {
  await supabaseAdmin.from("web_push_subscriptions").delete().eq("id", id);
}

export const webPushAdapter: ChannelAdapter = {
  id: "web_push",
  async isReady() {
    return ensureVapid();
  },
  async isAvailableFor(user: AppUserRow) {
    const prefs = parsePreferences(user.notification_preferences);
    if (!prefs.channels.web_push?.enabled) return false;
    const subs = await getSubscriptions(user.id);
    return subs.length > 0;
  },
  async send(notification: NotificationRow, user: AppUserRow) {
    if (!(await ensureVapid())) return { ok: false, error: "vapid_not_configured" };
    const subs = await getSubscriptions(user.id);
    if (subs.length === 0) return { ok: false, error: "no_subscriptions" };

    const event = getEventDescriptor(notification.event_type);
    if (!event) return { ok: false, error: "unknown_event" };
    const payload = renderEventForChannel(event, "web_push", notification.payload, user);
    if (!payload) return { ok: false, error: "no_push_template" };

    const body = JSON.stringify(payload);
    const results = await Promise.allSettled(
      subs.map((s) =>
        webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body
        )
      )
    );

    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (r.status === "rejected") {
        const status = (r.reason as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await deleteSubscription(subs[i].id);
        }
      }
    }

    const okCount = results.filter((r) => r.status === "fulfilled").length;
    return okCount > 0 ? { ok: true } : { ok: false, error: "all_subs_failed" };
  },
};
