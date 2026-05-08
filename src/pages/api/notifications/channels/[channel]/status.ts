/**
 * GET /api/notifications/channels/[channel]/status
 *
 * Returns whether the current user has linked a chat channel. Used by
 * ChannelLinkDialog to poll while waiting for the webhook to complete the
 * deep-link handshake.
 */
import type { APIRoute } from "astro";
import type { ChannelId } from "@/lib/notifications/types";
import { CHANNEL_IDS } from "@/lib/notifications/types";
import { getPreferences } from "@/lib/notifications/preferences";

export const prerender = false;

export const GET: APIRoute = async ({ params, locals }) => {
  const me = locals.user;
  if (!me) return new Response("Unauthorized", { status: 401 });

  const channel = params.channel as ChannelId | undefined;
  if (!channel || !(CHANNEL_IDS as readonly string[]).includes(channel)) {
    return new Response("Bad channel", { status: 400 });
  }

  const prefs = await getPreferences(me.id);
  const c = prefs.channels[channel];

  // Per-channel "linked" semantics (matches NotificationChannels.tsx).
  let linked = false;
  let label: string | null = null;
  if (c) {
    if (channel === "telegram") {
      linked = Boolean(c.chat_id);
      label = c.username ? `@${c.username}` : c.chat_id ?? null;
    } else if (channel === "zalo") {
      linked = Boolean(c.user_id);
      label = c.phone ?? c.user_id ?? null;
    } else if (channel === "messenger") {
      linked = Boolean(c.psid);
      label = c.psid ?? null;
    } else if (channel === "whatsapp" || channel === "sms") {
      linked = Boolean(c.phone);
      label = c.phone ?? null;
    } else {
      // email / in_app / web_push aren't "linked" via this flow
      linked = Boolean(c.enabled);
    }
  }

  return new Response(JSON.stringify({ linked, label }), {
    status: 200,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
  });
};
