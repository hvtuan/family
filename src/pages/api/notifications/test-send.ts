import type { APIRoute } from "astro";
import { dispatch } from "@/lib/notifications/dispatcher";
import type { EventType } from "@/lib/notifications/types";
import { EVENT_TYPES } from "@/lib/notifications/types";

export const prerender = false;

export const POST: APIRoute = async ({ request, locals }) => {
  const me = locals.user;
  if (!me || me.role !== "admin") return new Response("Forbidden", { status: 403 });

  const body = (await request.json().catch(() => null)) as { userId?: string; eventType?: string } | null;
  if (!body?.userId) return new Response("Bad payload", { status: 400 });

  const eventType = (EVENT_TYPES as readonly string[]).includes(body.eventType ?? "")
    ? (body.eventType as EventType)
    : "system.welcome";

  const result = await dispatch({
    eventType,
    recipientIds: [body.userId],
    payload: { memberName: "Test", memberId: "test-member" },
  });
  return new Response(JSON.stringify({ ok: true, ...result }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};
