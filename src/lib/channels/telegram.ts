/**
 * Telegram channel adapter — real implementation (Phase 2).
 *
 * Per-user link flow: user clicks "Liên kết" in profile → adapter
 * generates a 6-char link token → UI shows deep-link
 * `https://t.me/<bot_username>?start=<token>`. User opens it on phone,
 * Telegram auto-sends `/start <token>` to the bot. Our webhook receives
 * the message + chat info, validates the token via consumeLinkToken,
 * persists chat_id into app_users.notification_preferences.channels.telegram.
 *
 * Send is a thin REST call to api.telegram.org/bot<TOKEN>/sendMessage with
 * Markdown payload from renderEventForChannel.
 */
import type { ChannelAdapter, AppUserRow } from "./types";
import type { NotificationRow } from "@/lib/notifications/types";
import { getSetting } from "@/lib/settings";
import { parsePreferences, updatePreferences } from "@/lib/notifications/preferences";
import { createLinkToken, consumeLinkToken } from "@/lib/notifications/link-tokens";
import { getEventDescriptor, renderEventForChannel } from "@/lib/notifications/events";

export const telegramAdapter: ChannelAdapter = {
  id: "telegram",
  setupGuideUrl: "/admin/help#telegram",

  async isReady() {
    const [token, username] = await Promise.all([
      getSetting("notifications.telegram_bot_token"),
      getSetting("notifications.telegram_bot_username"),
    ]);
    return Boolean(token && username);
  },

  async isAvailableFor(user: AppUserRow) {
    const prefs = parsePreferences(user.notification_preferences);
    const tg = prefs.channels.telegram;
    return Boolean(tg?.enabled && tg?.chat_id);
  },

  async beginLink(user: AppUserRow) {
    const username = await getSetting("notifications.telegram_bot_username");
    if (!username) {
      throw new Error("telegram_bot_username not configured");
    }
    const token = await createLinkToken(user.id, "telegram");
    const cleanUsername = username.replace(/^@/, "");
    return {
      kind: "deeplink" as const,
      value: `https://t.me/${cleanUsername}?start=${token}`,
    };
  },

  async completeLink(user: AppUserRow, payload: Record<string, unknown>) {
    const token = String(payload.token ?? "");
    const chatId = payload.chatId;
    const username = payload.username;
    if (!token || (typeof chatId !== "string" && typeof chatId !== "number")) {
      return { ok: false };
    }
    const userId = await consumeLinkToken(token, "telegram");
    if (!userId || userId !== user.id) return { ok: false };
    await updatePreferences(user.id, {
      channels: {
        telegram: {
          enabled: true,
          chat_id: String(chatId),
          username: typeof username === "string" ? username : null,
        },
      },
    });
    return { ok: true };
  },

  async send(notification: NotificationRow, user: AppUserRow) {
    const token = await getSetting("notifications.telegram_bot_token");
    if (!token) return { ok: false, error: "telegram_token_not_configured" };
    const prefs = parsePreferences(user.notification_preferences);
    const chatId = prefs.channels.telegram?.chat_id;
    if (!chatId) return { ok: false, error: "not_linked" };
    const event = getEventDescriptor(notification.event_type);
    if (!event) return { ok: false, error: "unknown_event" };
    const text = renderEventForChannel(event, "telegram", notification.payload, user);
    if (typeof text !== "string") return { ok: false, error: "no_telegram_template" };
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "Markdown",
        disable_web_page_preview: false,
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return { ok: false, error: `telegram_${res.status}_${detail.slice(0, 80)}` };
    }
    return { ok: true };
  },
};
