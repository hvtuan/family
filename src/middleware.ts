/**
 * Auth gate for /admin/**.
 *
 * Public site (everything outside /admin/) is fully static, so it never hits
 * this middleware in production. Only the SSR routes opt in via
 * `export const prerender = false`.
 *
 * Flow:
 *   /admin/login, /admin/auth/**, /admin/pending → always allowed (no
 *     session check). /admin/login redirects logged-in users to /admin so
 *     the form doesn't get shown to someone who's already in.
 *   anything else under /admin/ →
 *     - no session → redirect /admin/login
 *     - session but no app_users row, or status != 'approved' →
 *       redirect /admin/pending. We deliberately do NOT auto-provision
 *       from family.allowed_emails — the bootstrap admin uses
 *       `pnpm admin:seed` and additional users are created by an admin
 *       through /admin/users, which assigns role/branch explicitly.
 *     - approved → continue, exposing { user, role, branch } on
 *       Astro.locals so pages don't have to re-query.
 */

import { defineMiddleware } from "astro:middleware";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

const ALLOW_UNAUTHED = new Set([
  "/admin/login",
  "/admin/pending",
]);

function isAllowedUnauthed(pathname: string): boolean {
  return ALLOW_UNAUTHED.has(pathname);
}

// Paths that need session lookup but should NOT redirect on miss — used by
// authed JSON endpoints under /api/* that the bell icon (and other React
// islands) poll. They populate locals.user for downstream handlers and let
// the handler itself return 401 JSON when the session is absent.
function isAuthedJsonApi(pathname: string): boolean {
  return (
    pathname.startsWith("/api/notifications") ||
    pathname.startsWith("/api/profile")
  );
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { request, cookies, redirect, locals, url } = context;
  const pathname = url.pathname.replace(/\/$/, "") || "/";

  const isAdminPath = pathname.startsWith("/admin");
  const isApiPath = isAuthedJsonApi(pathname);

  if (!isAdminPath && !isApiPath) {
    return next();
  }

  const supabase = createSupabaseServerClient(cookies, request);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Public allow-list (login + pending) — admin-side only
  if (isAdminPath && isAllowedUnauthed(pathname)) {
    if (pathname === "/admin/login" && user) {
      return redirect("/admin");
    }
    return next();
  }

  // No session: admin paths redirect to login; API paths fall through and
  // let the handler return 401 JSON so React islands can handle it.
  if (!user) {
    if (isAdminPath) {
      return redirect(`/admin/login?next=${encodeURIComponent(pathname)}`);
    }
    return next();
  }

  const { data: appUser } = await supabaseAdmin
    .from("app_users")
    .select("role, branch, status")
    .eq("id", user.id)
    .maybeSingle();

  // Pending / no app_user row: admin redirects, API returns 401 via handler
  if (!appUser || appUser.status !== "approved") {
    if (isAdminPath) return redirect("/admin/pending");
    return next();
  }

  locals.user = {
    id: user.id,
    email: user.email ?? "",
    role: appUser.role,
    branch: appUser.branch,
  };

  return next();
});
