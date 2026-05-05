#!/usr/bin/env node
/**
 * Seed (or reset) the bootstrap admin account.
 *
 * Username is "admin" → canonical email "admin@family.huynhvantuan.net".
 * Password defaults to "12345677@" but accepts an override via argv[1].
 *
 * Idempotent:
 *   - if the auth user exists, the password is updated;
 *   - if a family.app_users row exists, role/status/branch are reset to
 *     admin/approved/both.
 *
 * Usage:
 *   pnpm admin:seed
 *   pnpm admin:seed "newpassword!"
 */

import { createClient } from "@supabase/supabase-js";

const url = process.env.PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const schema = process.env.PUBLIC_SUPABASE_SCHEMA || "family";
if (!url || !serviceKey) {
  console.error("Missing PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const ADMIN_EMAIL = "admin@family.huynhvantuan.net";
const password = process.argv[2] || "12345677@";

const auth = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const db = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  db: { schema },
});

async function findUserByEmail(email) {
  // listUsers paginates; the seed script only needs the first match.
  const { data, error } = await auth.auth.admin.listUsers({ perPage: 200 });
  if (error) throw error;
  return data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
}

const existing = await findUserByEmail(ADMIN_EMAIL);
let userId;
if (existing) {
  console.log(`auth user exists (${existing.id}), updating password…`);
  const { error } = await auth.auth.admin.updateUserById(existing.id, {
    password,
  });
  if (error) {
    console.error("updateUser failed:", error.message);
    process.exit(1);
  }
  userId = existing.id;
} else {
  console.log("creating auth user…");
  const { data, error } = await auth.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password,
    email_confirm: true,
  });
  if (error || !data.user) {
    console.error("createUser failed:", error?.message);
    process.exit(1);
  }
  userId = data.user.id;
}

const row = {
  id: userId,
  email: ADMIN_EMAIL,
  role: "admin",
  branch: "both",
  status: "approved",
};

// upsert: on conflict, replace role/branch/status so the bootstrap account
// stays an admin even if it was demoted by a bug or test.
const { error: upsertErr } = await db
  .from("app_users")
  .upsert(row, { onConflict: "id" });
if (upsertErr) {
  console.error("upsert app_users failed:", upsertErr.message);
  process.exit(1);
}

console.log("");
console.log("admin account ready:");
console.log(`  username: admin`);
console.log(`  email:    ${ADMIN_EMAIL}`);
console.log(`  password: ${password}`);
console.log(`  role:     admin`);
console.log(`  branch:   both`);
