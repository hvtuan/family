import type { APIRoute } from "astro";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  const me = locals.user;
  if (!me) return new Response("Unauthorized", { status: 401 });

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") return new Response("Bad payload", { status: 400 });

  const displayName = typeof body.displayName === "string" ? body.displayName.trim().slice(0, 80) : null;
  const timezone = typeof body.timezone === "string" ? body.timezone.slice(0, 64) : null;
  const preferredLang =
    body.preferredLang === "vi" || body.preferredLang === "en" ? body.preferredLang : null;

  const update: Record<string, unknown> = {};
  if (displayName !== null) update.display_name = displayName;
  if (timezone !== null) update.timezone = timezone;
  if (preferredLang !== null) update.preferred_lang = preferredLang;

  if (Object.keys(update).length === 0) {
    return new Response(JSON.stringify({ ok: true, noop: true }), { status: 200 });
  }

  const { error } = await supabaseAdmin.from("app_users").update(update).eq("id", me.id);
  if (error) return new Response(error.message, { status: 500 });

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};
