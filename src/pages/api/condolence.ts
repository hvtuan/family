/**
 * /api/condolence
 *   POST — submit a "Lời tưởng nhớ" (status pending unless setting flips it)
 *   GET  — paginated approved list for a single member
 */
import type { APIRoute } from "astro";
import { submitCondolence, listApprovedFor } from "@/lib/condolences";
import { hashIp } from "@/lib/incense";

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
  const visitorRelation =
    typeof payload.visitorRelation === "string" ? payload.visitorRelation : null;
  const body = isLocalizedNonEmpty(payload.body) ? payload.body : null;

  if (!memberId || !visitorName || !body) {
    return json({ ok: false, reason: "invalid" }, 400);
  }

  const ip = clientAddress || request.headers.get("cf-connecting-ip") || "unknown";
  const ipHash = hashIp(ip);

  const result = await submitCondolence({
    memberId,
    visitorName,
    visitorRelation,
    body,
    ipHash,
  });

  return json(result, result.ok ? 200 : 400);
};

export const GET: APIRoute = async ({ url }) => {
  const memberId = url.searchParams.get("member") ?? "";
  const offset = clampInt(url.searchParams.get("offset"), 0, 0, 10000);
  const limit = clampInt(url.searchParams.get("limit"), 20, 1, 50);
  if (!memberId) return json({ items: [] }, 400);
  const items = await listApprovedFor(memberId, { limit, offset });
  return json({
    items: items.map((c) => ({
      id: c.id,
      visitorName: c.visitorName,
      visitorRelation: c.visitorRelation,
      body: c.body,
      createdAt: c.createdAt.toISOString(),
    })),
  });
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function isLocalizedNonEmpty(v: unknown): v is { vi?: string; en?: string } {
  if (!v || typeof v !== "object") return false;
  const obj = v as Record<string, unknown>;
  for (const val of Object.values(obj)) {
    if (typeof val === "string" && val.trim().length >= 5) return true;
  }
  return false;
}

function clampInt(raw: string | null, fallback: number, min: number, max: number): number {
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}
