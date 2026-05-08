import type { APIRoute } from "astro";
import { requireCronSecret } from "@/lib/cron-auth";
import { purgeOldNotifications } from "@/lib/notifications/purge";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const denied = requireCronSecret(request);
  if (denied) return denied;
  const result = await purgeOldNotifications();
  return new Response(JSON.stringify({ ok: true, ...result }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
};
