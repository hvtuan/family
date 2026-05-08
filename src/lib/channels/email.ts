/**
 * Email channel adapter. Wraps the existing src/lib/email.ts (memorial M5)
 * with the ChannelAdapter interface so the dispatcher routes through here.
 */
import type { ChannelAdapter, AppUserRow } from "./types";
import type { NotificationRow } from "@/lib/notifications/types";
import { sendEmail } from "@/lib/email";
import { getSetting } from "@/lib/settings";
import { renderEventForChannel, getEventDescriptor } from "@/lib/notifications/events";
import { parsePreferences } from "@/lib/notifications/preferences";

export const emailAdapter: ChannelAdapter = {
  id: "email",
  async isReady() {
    const [host, fromEmail] = await Promise.all([
      getSetting("smtp.host"),
      getSetting("smtp.from_email"),
    ]);
    return Boolean(host && fromEmail);
  },
  async isAvailableFor(user: AppUserRow) {
    const prefs = parsePreferences(user.notification_preferences);
    return Boolean(user.email && prefs.channels.email?.enabled);
  },
  async send(notification: NotificationRow, user: AppUserRow) {
    const event = getEventDescriptor(notification.event_type);
    if (!event) return { ok: false, error: "unknown_event" };
    const rendered = renderEventForChannel(event, "email", notification.payload, user);
    if (!rendered || typeof rendered === "string" || !("type" in rendered)) {
      return { ok: false, error: "no_email_template" };
    }
    const template = rendered;
    const result = await sendEmail({
      to: { email: user.email, name: user.display_name ?? undefined, lang: user.preferred_lang },
      subject: event.subject(notification.payload, user.preferred_lang),
      template,
    });
    return result.ok ? { ok: true } : { ok: false, error: result.reason };
  },
};
