/**
 * POST /admin/condolences/moderate
 *
 * Body: { ids: number[]; action: "approve" | "reject" }
 *
 * Auth: requires logged-in admin or branch_editor (existing middleware).
 */
import type { APIRoute } from "astro";
import { moderate } from "@/lib/condolences";

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  const me = locals.user;
  if (!me) return new Response("Unauthorized", { status: 401 });
  if (me.role !== "admin" && me.role !== "branch_editor") {
    return new Response("Forbidden", { status: 403 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return new Response("Bad payload", { status: 400 });
  }

  const ids = Array.isArray(payload.ids)
    ? payload.ids.filter((v): v is number => typeof v === "number")
    : [];
  const action = payload.action;
  if (action !== "approve" && action !== "reject") {
    return new Response("Bad action", { status: 400 });
  }
  if (ids.length === 0) return new Response(JSON.stringify({ ok: true, count: 0 }), { status: 200 });

  await Promise.all(ids.map((id) => moderate(id, action, me.id)));

  return new Response(JSON.stringify({ ok: true, count: ids.length }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};
