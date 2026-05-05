#!/usr/bin/env node
/**
 * P1 connectivity smoke test.
 *
 * Reads env from .env.local (loaded by node --env-file) and verifies:
 *   1. Service-role client can connect and SELECT system tables.
 *   2. All Phase 2 tables exist with the expected columns.
 *   3. Anon client can SELECT only when authenticated as approved user
 *      (we expect zero rows, no error — RLS is in effect).
 *   4. Storage `photos` bucket is reachable.
 *
 * Run after applying migrations 0001..0006:
 *   node --env-file=.env.local scripts/db-smoke.mjs
 */

import { createClient } from "@supabase/supabase-js";

const url = process.env.PUBLIC_SUPABASE_URL;
const anon = process.env.PUBLIC_SUPABASE_ANON_KEY;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anon || !serviceRole) {
  console.error("✗ missing env: PUBLIC_SUPABASE_URL / PUBLIC_SUPABASE_ANON_KEY / SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const schema = process.env.PUBLIC_SUPABASE_SCHEMA || "family";

const admin = createClient(url, serviceRole, {
  auth: { persistSession: false, autoRefreshToken: false },
  db: { schema },
});
const anonClient = createClient(url, anon, {
  auth: { persistSession: false, autoRefreshToken: false },
  db: { schema },
});

let failures = 0;
function assert(label, cond, detail = "") {
  if (cond) {
    console.log(`  ✓ ${label}${detail ? "  " + detail : ""}`);
  } else {
    console.log(`  ✗ ${label}${detail ? "  " + detail : ""}`);
    failures += 1;
  }
}

async function main() {
  console.log("=== 1. Connectivity (service role) ===");
  const { error: pingErr } = await admin.from("app_users").select("id", { count: "exact", head: true });
  assert("service-role connects + sees app_users", !pingErr, pingErr?.message ?? "");

  console.log("\n=== 2. Tables exist (HEAD select on each) ===");
  const expectedTables = [
    "app_users", "allowed_emails", "audit_log",
    "members", "member_children", "timeline", "timeline_members",
    "traditions", "photos", "photo_members", "quotes",
    "dates", "locations", "location_members",
  ];
  for (const t of expectedTables) {
    const { error } = await admin.from(t).select("*", { head: true, count: "exact" });
    assert(`${t}`, !error, error?.message ?? "");
  }

  console.log("\n=== 3. RLS active (anon SELECT returns 0 rows on members) ===");
  const { data: anonRows, error: anonErr } = await anonClient
    .from("members")
    .select("id")
    .limit(1);
  assert(
    "anon SELECT on members blocked or empty (RLS)",
    !anonErr && (anonRows ?? []).length === 0,
    anonErr ? anonErr.message : `rows: ${anonRows?.length ?? 0}`,
  );

  console.log("\n=== 4. Storage bucket 'family-photos' exists ===");
  const { data: bucket, error: bucketErr } = await admin.storage.getBucket("family-photos");
  assert("family-photos bucket reachable", !bucketErr, bucketErr ? bucketErr.message : `public=${bucket?.public}`);

  console.log("\n=== 5. Helper functions callable ===");
  const { data: roleProbe, error: roleErr } = await admin.rpc("current_role");
  // service_role won't be approved in app_users, so result is null but no error
  assert("family.current_role() callable", !roleErr, roleErr ? roleErr.message : `returns: ${roleProbe ?? "null"}`);

  console.log("\n=== 6. Audit log empty / writable via trigger ===");
  // Insert a throwaway location row, then confirm audit_log captured it
  const tempId = `__smoke_${Date.now()}`;
  const { error: insErr } = await admin.from("locations").insert({
    id: tempId,
    name: "Smoke",
    name_en: "Smoke",
    province: "Test",
    lat: 0,
    lng: 0,
  });
  assert("can insert into locations (service role)", !insErr, insErr?.message ?? "");

  if (!insErr) {
    const { data: log, error: logErr } = await admin
      .from("audit_log")
      .select("entity_type, entity_id, action")
      .eq("entity_type", "locations")
      .eq("entity_id", tempId)
      .limit(1);
    assert(
      "audit_log captured the insert",
      !logErr && (log ?? []).length === 1 && log[0].action === "insert",
      logErr ? logErr.message : JSON.stringify(log),
    );

    const { error: delErr } = await admin.from("locations").delete().eq("id", tempId);
    assert("cleanup: delete smoke row", !delErr, delErr?.message ?? "");
  }

  console.log(failures === 0 ? "\n✓ all smoke checks passed" : `\n✗ ${failures} failure(s)`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("unhandled:", err);
  process.exit(1);
});
