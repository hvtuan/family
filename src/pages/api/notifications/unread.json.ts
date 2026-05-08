import type { APIRoute } from "astro";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const prerender = false;

export const GET: APIRoute = async ({ locals }) => {
  const me = locals.user;
  if (!me) return new Response(JSON.stringify({ count: 0, items: [] }), { status: 401 });

  const [{ count }, { data: items }] = await Promise.all([
    supabaseAdmin
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", me.id)
      .is("seen_at", null),
    supabaseAdmin
      .from("notifications")
      .select("id, event_type, payload, created_at, seen_at")
      .eq("user_id", me.id)
      .order("created_at", { ascending: false })
      .limit(10),
  ]);

  const list = (items ?? []).map((row) => ({
    id: row.id as number,
    eventType: row.event_type as string,
    payload: row.payload as Record<string, unknown>,
    createdAt: row.created_at as string,
    seen: row.seen_at != null,
  }));

  return new Response(JSON.stringify({ count: count ?? 0, items: list }), {
    status: 200,
    headers: {
      "content-type": "application/json",
      "cache-control": "no-store",
    },
  });
};
