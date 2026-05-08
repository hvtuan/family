/**
 * POST /api/notifications/channels/[channel]/begin
 *
 * Calls adapter.beginLink(user) and returns the link payload (deeplink URL,
 * code, or oauth URL) so the UI can display + redirect.
 */
import type { APIRoute } from "astro";
import { channelRegistry } from "@/lib/channels/registry";
import type { ChannelId } from "@/lib/notifications/types";
import { CHANNEL_IDS } from "@/lib/notifications/types";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const prerender = false;

export const POST: APIRoute = async ({ params, locals }) => {
  const me = locals.user;
  if (!me) return new Response("Unauthorized", { status: 401 });

  const channel = params.channel as ChannelId | undefined;
  if (!channel || !(CHANNEL_IDS as readonly string[]).includes(channel)) {
    return new Response("Bad channel", { status: 400 });
  }

  const adapter = channelRegistry[channel];
  if (!adapter.beginLink) {
    return new Response("Channel does not support linking", { status: 400 });
  }

  const ready = await adapter.isReady();
  if (!ready) {
    return new Response("Channel not configured by admin", { status: 503 });
  }

  // Load full user row so adapter has all fields it might need
  const { data, error } = await supabaseAdmin
    .from("app_users")
    .select("id, email, display_name, preferred_lang, timezone, notification_preferences")
    .eq("id", me.id)
    .maybeSingle();
  if (error || !data) return new Response("User not found", { status: 404 });

  try {
    const payload = await adapter.beginLink(data as never);
    return new Response(JSON.stringify({ ok: true, ...payload }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ ok: false, error: err instanceof Error ? err.message : "begin_failed" }),
      { status: 500, headers: { "content-type": "application/json" } }
    );
  }
};
