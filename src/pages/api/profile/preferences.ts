import type { APIRoute } from "astro";
import { updatePreferences } from "@/lib/notifications/preferences";
import type { NotificationPreferences } from "@/lib/notifications/types";

export const prerender = false;

export const PATCH: APIRoute = async ({ request, locals }) => {
  const me = locals.user;
  if (!me) return new Response("Unauthorized", { status: 401 });

  const body = (await request.json().catch(() => null)) as Partial<NotificationPreferences> | null;
  if (!body || typeof body !== "object") return new Response("Bad payload", { status: 400 });

  await updatePreferences(me.id, body);
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};
