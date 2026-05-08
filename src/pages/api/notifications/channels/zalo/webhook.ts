/**
 * POST /api/notifications/channels/zalo/webhook
 *
 * Zalo OA delivers events here. We listen for `user_send_text` events —
 * after a user follows the OA, our welcome message asks them to reply
 * with their 6-char link token. The webhook captures the message + the
 * sender's Zalo user_id, validates the token, and flips
 * `prefs.channels.zalo` for the matching app_user.
 *
 * Authenticity: Zalo signs each webhook with HMAC SHA256 of the raw body
 * using the OA's `app_secret`, sent as the `X-ZEvent-Signature` header.
 * We verify via timing-safe compare. The secret lives in
 * `notifications.zalo_webhook_secret` (settings).
 *
 * Events we handle:
 *   - user_send_text — body.message.text contains the link token
 *   - follow / unfollow — logged but not actioned (link only happens
 *     when user explicitly sends the token)
 *
 * Reference: https://developers.zalo.me/docs/api/official-account-api/webhook
 */
import type { APIRoute } from "astro";
import { createHmac, timingSafeEqual } from "node:crypto";
import { getSetting } from "@/lib/settings";
import { zaloAdapter } from "@/lib/channels/zalo";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const prerender = false;

interface ZaloEvent {
  event_name?: string;
  sender?: { id: string };
  recipient?: { id: string };
  message?: { text?: string; msg_id?: string };
  follower?: { id: string };
  timestamp?: string;
}

const TOKEN_RE = /\b([A-Z2-9]{6})\b/;

export const POST: APIRoute = async ({ request }) => {
  // Read raw body once — we need it both for signature verify AND parse.
  const raw = await request.text();

  const expectedSecret = await getSetting("notifications.zalo_webhook_secret");
  if (!expectedSecret) {
    return json({ ok: false, reason: "webhook_secret_not_configured" }, 500);
  }

  const provided = request.headers.get("x-zevent-signature") ?? "";
  if (!verifyHmac(raw, expectedSecret, provided)) {
    return new Response("Unauthorized", { status: 401 });
  }

  let event: ZaloEvent;
  try {
    event = JSON.parse(raw) as ZaloEvent;
  } catch {
    return json({ ok: false, reason: "bad_payload" }, 400);
  }

  // Only act on text messages from users
  if (event.event_name !== "user_send_text") {
    return json({ ok: true, ignored: event.event_name ?? "no_event" });
  }

  const senderId = event.sender?.id;
  const text = event.message?.text;
  if (!senderId || !text) {
    return json({ ok: true, ignored: "missing_sender_or_text" });
  }

  const tokenMatch = TOKEN_RE.exec(text);
  if (!tokenMatch) {
    return json({ ok: true, ignored: "no_token_in_text" });
  }
  const token = tokenMatch[1];

  // Look up the link token to find the user
  const { data: tokenRow, error: tokenErr } = await supabaseAdmin
    .from("notification_link_tokens")
    .select("user_id, channel_id, expires_at, consumed_at")
    .eq("token", token)
    .maybeSingle();
  if (tokenErr || !tokenRow || tokenRow.channel_id !== "zalo") {
    return json({ ok: true, ignored: "unknown_token" });
  }

  const { data: appUser, error: userErr } = await supabaseAdmin
    .from("app_users")
    .select("id, email, display_name, preferred_lang, timezone, notification_preferences")
    .eq("id", tokenRow.user_id)
    .maybeSingle();
  if (userErr || !appUser) {
    return json({ ok: true, ignored: "user_not_found" });
  }

  const result = await zaloAdapter.completeLink!(appUser as never, {
    userId: senderId,
    token,
  });

  return json({ ok: true, completed: result.ok });
};

function verifyHmac(raw: string, secret: string, provided: string): boolean {
  if (!provided) return false;
  const expected = createHmac("sha256", secret).update(raw).digest("hex");
  // Strip optional "sha256=" prefix if Zalo sends it that way
  const cleanProvided = provided.replace(/^sha256=/, "");
  if (cleanProvided.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(cleanProvided, "hex"), Buffer.from(expected, "hex"));
  } catch {
    return false;
  }
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
