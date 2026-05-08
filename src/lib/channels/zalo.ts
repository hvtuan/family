/**
 * Zalo Official Account adapter — real implementation (Phase 2).
 *
 * Per-user link flow (different from Telegram because Zalo doesn't support
 * deep-link `start=<token>` natively):
 *   1. User clicks "Liên kết" → adapter.beginLink generates token + returns
 *      OA follow URL `https://oa.zalo.me/<oa_id>`
 *   2. User opens URL → follows the OA → OA auto-sends welcome message
 *      asking user to reply with the 6-char token
 *   3. User replies with token → webhook receives `user_send_text` event
 *      with sender.id (zalo user_id) + text → calls completeLink with the
 *      token + zalo user_id → flip prefs
 *
 * Token expiry: Zalo access tokens last 90 days. Admin must manually
 * refresh (no automatic refresh in Phase 2 — see setup.md).
 */
import type { ChannelAdapter, AppUserRow } from "./types";
import type { NotificationRow } from "@/lib/notifications/types";
import { getSetting } from "@/lib/settings";
import { parsePreferences, updatePreferences } from "@/lib/notifications/preferences";
import { createLinkToken, consumeLinkToken } from "@/lib/notifications/link-tokens";
import { getEventDescriptor, renderEventForChannel } from "@/lib/notifications/events";

export const zaloAdapter: ChannelAdapter = {
  id: "zalo",
  setupGuideUrl: "/admin/help#zalo",

  async isReady() {
    const [token, oaId] = await Promise.all([
      getSetting("notifications.zalo_oa_token"),
      getSetting("notifications.zalo_oa_id"),
    ]);
    return Boolean(token && oaId);
  },

  async isAvailableFor(user: AppUserRow) {
    const prefs = parsePreferences(user.notification_preferences);
    const z = prefs.channels.zalo;
    return Boolean(z?.enabled && z?.user_id);
  },

  async beginLink(user: AppUserRow) {
    const oaId = await getSetting("notifications.zalo_oa_id");
    if (!oaId) throw new Error("zalo_oa_id not configured");
    const token = await createLinkToken(user.id, "zalo");
    // The OA follow URL takes the user to the public OA page where they
    // can subscribe. The token itself is shown to the user out-of-band so
    // they can paste it as a chat message after following — the webhook
    // matches the token to identify the user.
    const followUrl = `https://oa.zalo.me/${oaId}`;
    return {
      kind: "url" as const,
      // Compose: URL + token in fragment so the dialog UI can show both.
      // ChannelLinkDialog displays value as link target; we'll embed the
      // token as a query param for display only — the actual binding is
      // user-typed via OA chat.
      value: `${followUrl}?ref=${token}`,
    };
  },

  async completeLink(user: AppUserRow, payload: Record<string, unknown>) {
    const token = String(payload.token ?? "");
    const userIdZalo = payload.userId;
    if (!token || (typeof userIdZalo !== "string" && typeof userIdZalo !== "number")) {
      return { ok: false };
    }
    const userId = await consumeLinkToken(token, "zalo");
    if (!userId || userId !== user.id) return { ok: false };
    await updatePreferences(user.id, {
      channels: {
        zalo: {
          enabled: true,
          user_id: String(userIdZalo),
          phone: typeof payload.phone === "string" ? payload.phone : null,
        },
      },
    });
    return { ok: true };
  },

  async send(notification: NotificationRow, user: AppUserRow) {
    const token = await getSetting("notifications.zalo_oa_token");
    if (!token) return { ok: false, error: "zalo_token_not_configured" };
    const prefs = parsePreferences(user.notification_preferences);
    const zaloUserId = prefs.channels.zalo?.user_id;
    if (!zaloUserId) return { ok: false, error: "not_linked" };
    const event = getEventDescriptor(notification.event_type);
    if (!event) return { ok: false, error: "unknown_event" };
    const text = renderEventForChannel(event, "zalo", notification.payload, user);
    if (typeof text !== "string") return { ok: false, error: "no_zalo_template" };

    const res = await fetch("https://openapi.zalo.me/v3.0/oa/message/transmessage", {
      method: "POST",
      headers: {
        "access_token": token,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        recipient: { user_id: zaloUserId },
        message: { text },
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      return { ok: false, error: `zalo_${res.status}_${detail.slice(0, 80)}` };
    }
    const body = await res.json().catch(() => ({} as Record<string, unknown>));
    if (typeof body.error === "number" && body.error !== 0) {
      return { ok: false, error: `zalo_api_error_${body.error}` };
    }
    return { ok: true };
  },
};
