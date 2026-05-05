#!/usr/bin/env node
/**
 * Generate a magic-link URL for a given email without sending email.
 *
 * Usage:
 *   pnpm admin:link <email> [redirectTo]
 *   pnpm admin:link cohai@example.com
 *   pnpm admin:link cohai@example.com http://localhost:4321/admin/auth/callback
 *
 * Default redirect is the production callback. Override the second arg for
 * local testing while `pnpm dev` is running.
 *
 * The output is a one-time URL that the admin shares (Zalo / Facebook / SMS)
 * with the invited person. Clicking it signs them in once and provisions
 * an app_users row via the middleware on the first /admin request.
 *
 * GoTrue's `redirect_to` is restricted by ADDITIONAL_REDIRECT_URLS on the
 * Supabase service. If a destination is rejected, GoTrue silently falls
 * back to GOTRUE_SITE_URL.
 */

import { createClient } from "@supabase/supabase-js";

const url = process.env.PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Missing PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const email = process.argv[2];
const redirect =
  process.argv[3] ?? "https://family.huynhvantuan.net/admin/auth/callback";
if (!email) {
  console.error("usage: node scripts/admin-magic-link.mjs <email> [redirectTo]");
  process.exit(1);
}

const admin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data, error } = await admin.auth.admin.generateLink({
  type: "magiclink",
  email,
  options: { redirectTo: redirect },
});

if (error) {
  console.error("generateLink failed:", error.message);
  process.exit(1);
}

const action = data?.properties?.action_link;
if (!action) {
  console.error("no action_link in response:", JSON.stringify(data));
  process.exit(1);
}

console.log(action);
