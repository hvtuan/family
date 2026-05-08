/**
 * Bearer-secret guard for cron endpoints under /admin/cron/*.
 *
 * Reads CRON_SECRET from env. Returns a 401 Response when the request
 * is missing or wrong; returns null when the request is authorized so
 * the handler can continue.
 */
export function requireCronSecret(request: Request): Response | null {
  const expected =
    process.env.CRON_SECRET ??
    (import.meta.env as Record<string, string | undefined>).CRON_SECRET;

  if (!expected) {
    return new Response("CRON_SECRET not configured on server", { status: 500 });
  }

  const auth = request.headers.get("authorization") ?? "";
  const provided = auth.startsWith("Bearer ") ? auth.slice("Bearer ".length).trim() : "";

  if (!provided || !timingSafeEqual(provided, expected)) {
    return new Response("Unauthorized", { status: 401 });
  }
  return null;
}

/** Constant-time string comparison to deny side-channel timing attacks. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
