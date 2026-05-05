/**
 * Trigger a Coolify rebuild of this very app. Admin-only.
 *
 * The public site is fully static — content is read from family.* at
 * `astro build` time, not at request time. So an edit in /admin doesn't
 * appear on / until something rebuilds. This endpoint is the "publish"
 * button: it POSTs to Coolify's deploy API, which rebuilds the same
 * commit (no git change) but re-runs prerender against fresh DB data.
 *
 * Auth: middleware already requires an approved app_users session, plus
 * we re-check role=admin here because the rebuild button is admin-only
 * on the dashboard.
 *
 * Token: COOLIFY_API_TOKEN is admin-scope on Coolify. Acceptable for a
 * 5–10-person family site, but a follow-up could narrow it.
 */

import type { APIRoute } from "astro";
import { logAudit } from "@/lib/audit";

export const prerender = false;

export const POST: APIRoute = async ({ locals, redirect }) => {
  const me = locals.user;
  if (!me || me.role !== "admin") {
    return new Response("Forbidden", { status: 403 });
  }

  const baseUrl = process.env.COOLIFY_BASE_URL;
  const token = process.env.COOLIFY_API_TOKEN;
  const appUuid = process.env.COOLIFY_APP_UUID;

  if (!baseUrl || !token || !appUuid) {
    return redirect("/admin?err=rebuild_unconfigured");
  }

  try {
    const res = await fetch(
      `${baseUrl}/api/v1/deploy?uuid=${appUuid}&force=false`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      },
    );
    if (!res.ok) {
      const text = await res.text();
      return redirect(
        `/admin?err=${encodeURIComponent(`rebuild_failed: ${res.status} ${text.slice(0, 80)}`)}`,
      );
    }

    await logAudit({
      actorId: me.id,
      action: "update",
      entityType: "app_users",
      entityId: "rebuild",
      diff: { triggered: true, at: new Date().toISOString() },
    });

    return redirect("/admin?ok=rebuild_started");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unknown";
    return redirect(`/admin?err=${encodeURIComponent(`rebuild_error: ${msg}`)}`);
  }
};
