/**
 * POST /api/notifications/channels/telegram/webhook
 *
 * Telegram delivers Bot API updates here. We only care about /start <token>
 * messages — those are the link-flow handshake. Everything else is acked
 * with 200 to keep the webhook subscription alive but ignored.
 *
 * Authenticity: Telegram sends back our setWebhook `secret_token` as the
 * `X-Telegram-Bot-Api-Secret-Token` header. We compare it (timing-safe) with
 * the value stored in family.settings.
 */
import type { APIRoute } from "astro";
import { getSetting } from "@/lib/settings";
import { telegramAdapter } from "@/lib/channels/telegram";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const prerender = false;

interface TelegramMessage {
  chat?: { id: number; username?: string; first_name?: string; last_name?: string };
  text?: string;
  from?: { id: number; username?: string };
}
interface TelegramUpdate {
  message?: TelegramMessage;
}

export const POST: APIRoute = async ({ request }) => {
  // Step 1 — verify secret
  const expected = await getSetting("notifications.telegram_webhook_secret");
  if (!expected) {
    return json({ ok: false, reason: "webhook_secret_not_configured" }, 500);
  }
  const provided = request.headers.get("x-telegram-bot-api-secret-token") ?? "";
  if (!timingSafeEqual(expected, provided)) {
    return new Response("Unauthorized", { status: 401 });
  }

  // Step 2 — parse update
  let update: TelegramUpdate;
  try {
    update = (await request.json()) as TelegramUpdate;
  } catch {
    return json({ ok: false, reason: "bad_payload" }, 400);
  }

  const message = update.message;
  if (!message?.text || !message.chat) {
    return json({ ok: true, ignored: "no_message_text" });
  }

  // Step 3 — handle /start <token>
  const startMatch = /^\/start\s+([A-Z2-9]{6})$/.exec(message.text.trim());
  if (!startMatch) {
    return json({ ok: true, ignored: "non_start_message" });
  }
  const token = startMatch[1];

  // Look up the link token to find the user (the adapter's completeLink
  // expects the user record, not the user_id, so we re-load).
  const { data: tokenRow, error: tokenErr } = await supabaseAdmin
    .from("notification_link_tokens")
    .select("user_id, channel_id, expires_at, consumed_at")
    .eq("token", token)
    .maybeSingle();
  if (tokenErr || !tokenRow || tokenRow.channel_id !== "telegram") {
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

  const result = await telegramAdapter.completeLink!(appUser as never, {
    chatId: message.chat.id,
    username: message.chat.username ?? message.from?.username ?? null,
    token,
  });

  if (!result.ok) {
    return json({ ok: true, completed: false });
  }

  // Send a friendly confirmation reply via the adapter's send infrastructure
  // (skipped here — keep the webhook lean; user sees status flip in UI poll).

  return json({ ok: true, completed: true });
};

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}
