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
 *     we don't keep showing "contact admin to be invited" to someone who
 *     is already in.
 *   anything else under /admin/ →
 *     - no session → redirect /admin/login
 *     - session but no app_users row → look up family.allowed_emails by
 *       email; insert row with role/branch from whitelist (status=approved)
 *       or status=pending if not whitelisted. This is the single
 *       provisioning point — the auth callback page intentionally does not
 *       touch the DB so PKCE and implicit-flow logins follow the same path.
 *     - status != 'approved' → redirect /admin/pending
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
  if (ALLOW_UNAUTHED.has(pathname)) return true;
  if (pathname.startsWith("/admin/auth/")) return true;
  return false;
}

type AppUserRow = {
  role: "admin" | "editor" | "branch_editor";
  branch: "noi" | "ngoai" | "both" | null;
  status: "pending" | "approved" | "revoked";
};

async function provisionAppUser(
  userId: string,
  email: string,
): Promise<AppUserRow | null> {
  const { data: whitelist } = await supabaseAdmin
    .from("allowed_emails")
    .select("role, branch")
    .eq("email", email.toLowerCase())
    .maybeSingle();

  const row: AppUserRow & { id: string; email: string } = whitelist
    ? {
        id: userId,
        email,
        role: whitelist.role,
        branch: whitelist.branch,
        status: "approved",
      }
    : {
        id: userId,
        email,
        role: "branch_editor",
        branch: null,
        status: "pending",
      };

  const { error } = await supabaseAdmin.from("app_users").insert(row);
  if (error) {
    // Race: another concurrent request may have inserted first. Re-read.
    const { data } = await supabaseAdmin
      .from("app_users")
      .select("role, branch, status")
      .eq("id", userId)
      .maybeSingle();
    return data as AppUserRow | null;
  }

  return { role: row.role, branch: row.branch, status: row.status };
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

  let { data: appUser } = await supabaseAdmin
    .from("app_users")
    .select("role, branch, status")
    .eq("id", user.id)
    .maybeSingle();

  if (!appUser) {
    appUser = await provisionAppUser(user.id, user.email ?? "");
  }

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
