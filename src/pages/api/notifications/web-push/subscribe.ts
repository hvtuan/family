import type { APIRoute } from "astro";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { updatePreferences } from "@/lib/notifications/preferences";

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  const me = locals.user;
  if (!me) return new Response("Unauthorized", { status: 401 });

  const body = await request.json().catch(() => null);
  const subscription = (body as { subscription?: unknown })?.subscription;
  if (!subscription || typeof subscription !== "object") {
    return new Response("Bad payload", { status: 400 });
  }

  const sub = subscription as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  const userAgent = request.headers.get("user-agent") ?? "";
  if (!sub.endpoint || !sub.keys?.p256dh || !sub.keys.auth) {
    return new Response("Invalid subscription", { status: 400 });
  }

  const { error } = await supabaseAdmin
    .from("web_push_subscriptions")
    .upsert(
      {
        user_id: me.id,
        endpoint: sub.endpoint,
        p256dh: sub.keys.p256dh,
        auth: sub.keys.auth,
        user_agent: userAgent.slice(0, 240),
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "endpoint" }
    );
  if (error) return new Response(error.message, { status: 500 });

  await updatePreferences(me.id, { channels: { web_push: { enabled: true } } });

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};

export const DELETE: APIRoute = async ({ request, locals }) => {
  const me = locals.user;
  if (!me) return new Response("Unauthorized", { status: 401 });

  const body = await request.json().catch(() => null);
  const endpoint = (body as { endpoint?: string })?.endpoint;
  if (!endpoint) return new Response("Bad payload", { status: 400 });

  await supabaseAdmin
    .from("web_push_subscriptions")
    .delete()
    .eq("user_id", me.id)
    .eq("endpoint", endpoint);

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};
