/**
 * POST /api/incense — public "thắp tâm hương" endpoint.
 *
 * Body: { memberId, visitorName, message?: { vi?, en? }, anniversaryYear? }
 * Rate-limited per IP-hash via lib/incense.ts.
 */
import type { APIRoute } from "astro";
import { recordIncense, hashIp } from "@/lib/incense";

export const prerender = false;

export const POST: APIRoute = async ({ request, clientAddress }) => {
  let payload: Record<string, unknown>;
  try {
    payload = await request.json();
  } catch {
    return json({ ok: false, reason: "invalid" }, 400);
  }

  const memberId = typeof payload.memberId === "string" ? payload.memberId : "";
  const visitorName = typeof payload.visitorName === "string" ? payload.visitorName : "";
  const message = isLocalized(payload.message) ? payload.message : undefined;
  const anniversaryYear =
    typeof payload.anniversaryYear === "number" && Number.isFinite(payload.anniversaryYear)
      ? Math.floor(payload.anniversaryYear)
      : new Date().getFullYear();

  if (!memberId || !visitorName) {
    return json({ ok: false, reason: "invalid" }, 400);
  }

  const ip = clientAddress || request.headers.get("cf-connecting-ip") || "unknown";
  const ipHash = hashIp(ip);

  const result = await recordIncense({
    memberId,
    visitorName,
    message,
    ipHash,
    anniversaryYear,
  });

  if (!result.ok) {
    const status = result.reason === "rate_limit" ? 429 : 400;
    return json(result, status);
  }
  return json(result, 200);
};

function json(data: unknown, status: number): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function isLocalized(v: unknown): v is { vi?: string; en?: string } {
  if (!v || typeof v !== "object") return false;
  const obj = v as Record<string, unknown>;
  return Object.values(obj).every((val) => val === undefined || typeof val === "string");
}
