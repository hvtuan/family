/**
 * Magic-link callback. Supabase redirects here with `?code=<...>` after the
 * user clicks the email link. We exchange the code for a session, then
 * upsert app_users based on the allowed_emails whitelist:
 *   - email is whitelisted → status='approved', role/branch from whitelist
 *   - not whitelisted    → status='pending', role='branch_editor', branch=null
 *                          (admin reviews via /admin/users)
 *
 * Whitelist lookup uses the service-role client to bypass RLS — the user's
 * own session can't read allowed_emails (admin-only policy).
 */

import type { APIRoute } from "astro";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";

export const prerender = false;

export const GET: APIRoute = async ({ request, cookies, url, redirect }) => {
  const code = url.searchParams.get("code");
  const errorParam = url.searchParams.get("error_description") ?? url.searchParams.get("error");
  const next = url.searchParams.get("next") ?? "/admin";

  if (errorParam) {
    return redirect(`/admin/login?err=${encodeURIComponent(errorParam)}`);
  }
  if (!code) {
    return redirect("/admin/login?err=missing_code");
  }

  const supabase = createSupabaseServerClient(cookies, request);
  const { data, error } = await supabase.auth.exchangeCodeForSession(code);
  if (error || !data.user) {
    return redirect(
      `/admin/login?err=${encodeURIComponent(error?.message ?? "exchange_failed")}`,
    );
  }

  const { user } = data;
  const email = (user.email ?? "").toLowerCase();

  const { data: existing } = await supabaseAdmin
    .from("app_users")
    .select("id, status")
    .eq("id", user.id)
    .maybeSingle();

  if (!existing) {
    const { data: whitelist } = await supabaseAdmin
      .from("allowed_emails")
      .select("role, branch")
      .eq("email", email)
      .maybeSingle();

    const row: {
      id: string;
      email: string;
      role: "admin" | "editor" | "branch_editor";
      branch: "noi" | "ngoai" | "both" | null;
      status: "approved" | "pending";
    } = whitelist
      ? {
          id: user.id,
          email,
          role: whitelist.role,
          branch: whitelist.branch,
          status: "approved",
        }
      : {
          id: user.id,
          email,
          role: "branch_editor",
          branch: null,
          status: "pending",
        };

    const { error: insertErr } = await supabaseAdmin.from("app_users").insert(row);
    if (insertErr) {
      return redirect(
        `/admin/login?err=${encodeURIComponent("provision_failed: " + insertErr.message)}`,
      );
    }

    if (row.status === "pending") {
      return redirect("/admin/pending");
    }
  } else if (existing.status !== "approved") {
    return redirect("/admin/pending");
  }

  return redirect(next);
};
