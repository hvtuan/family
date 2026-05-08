import type { APIRoute } from "astro";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  const me = locals.user;
  if (!me) return new Response("Unauthorized", { status: 401 });

  const body = await request.json().catch(() => ({}));
  const ids: number[] = Array.isArray((body as { ids?: unknown }).ids)
    ? ((body as { ids: unknown[] }).ids).filter((v): v is number => typeof v === "number")
    : [];
  const all = (body as { all?: unknown }).all === true;

  const update = supabaseAdmin
    .from("notifications")
    .update({ seen_at: new Date().toISOString() })
    .eq("user_id", me.id)
    .is("seen_at", null);

  const query = all ? update : update.in("id", ids.length ? ids : [-1]);
  const { error } = await query;
  if (error) return new Response(error.message, { status: 500 });
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};
