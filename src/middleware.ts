/**
 * Auth gate for /admin/**.
 *
 * Public site (everything outside /admin/) is fully static, so it never hits
 * this middleware in production. Only the SSR routes opt in via
 * `export const prerender = false`.
 *
 * Flow:
 *   /admin/login, /admin/auth/**, /admin/pending → always allowed (no session
 *     check). /admin/login redirects logged-in users to /admin so we don't
 *     keep showing a login form to someone who's already in.
 *   anything else under /admin/ →
 *     - no session → redirect /admin/login
 *     - session but no app_users row, or status != 'approved' →
 *       redirect /admin/pending
 *     - approved → continue, exposing { user, role, branch } on
 *       Astro.locals so pages don't have to re-query.
 */

import { defineMiddleware } from "astro:middleware";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const ALLOW_UNAUTHED = new Set([
  "/admin/login",
  "/admin/pending",
]);

function isAllowedUnauthed(pathname: string): boolean {
  if (ALLOW_UNAUTHED.has(pathname)) return true;
  if (pathname.startsWith("/admin/auth/")) return true;
  return false;
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { request, cookies, redirect, locals, url } = context;
  const pathname = url.pathname.replace(/\/$/, "") || "/";

  if (!pathname.startsWith("/admin")) {
    return next();
  }

  const supabase = createSupabaseServerClient(cookies, request);
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (isAllowedUnauthed(pathname)) {
    if (pathname === "/admin/login" && user) {
      return redirect("/admin");
    }
    return next();
  }

  if (!user) {
    return redirect(`/admin/login?next=${encodeURIComponent(pathname)}`);
  }

  const { data: appUser } = await supabase
    .from("app_users")
    .select("role, branch, status")
    .eq("id", user.id)
    .maybeSingle();

  if (!appUser || appUser.status !== "approved") {
    return redirect("/admin/pending");
  }

  locals.user = {
    id: user.id,
    email: user.email ?? "",
    role: appUser.role,
    branch: appUser.branch,
  };

  return next();
});
