#!/usr/bin/env node
/**
 * Apply supabase/migrations/*.sql files to a Supabase Postgres instance.
 *
 * Usage:
 *   node --env-file=.env.local scripts/db-migrate.mjs
 *
 * Required env (in .env.local):
 *   SUPABASE_DB_URL  postgres://postgres:<password>@db.<ref>.supabase.co:5432/postgres
 *                    (Or the connection-pooler URL on port 6543; either works
 *                    since these migrations are short-lived sessions.)
 *   ADMIN_EMAIL      email seeded into allowed_emails as role=admin (recommended)
 *
 * Migrations are applied in lexical order. Files are split into individual
 * statements on `;` boundaries that aren't inside dollar-quoted blocks so we
 * can run them through the `postgres` npm driver (which expects one statement
 * per query call). This is intentionally simple: migrations should remain
 * idempotent so re-running is safe.
 */

import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import postgres from "postgres";

const dbUrl = process.env.SUPABASE_DB_URL;
const adminEmail = process.env.ADMIN_EMAIL;

if (!dbUrl) {
  console.error("✗ missing env SUPABASE_DB_URL");
  process.exit(1);
}

const sql = postgres(dbUrl, {
  max: 1,
  idle_timeout: 5,
  connect_timeout: 30,
  prepare: false,            // pgbouncer-friendly
  onnotice: (n) => console.log(`  ⓘ ${n.message}`),
});

const migrationsDir = new URL("../supabase/migrations/", import.meta.url).pathname;
const files = (await readdir(migrationsDir))
  .filter((f) => f.endsWith(".sql"))
  .sort();

if (files.length === 0) {
  console.error("✗ no migrations found in supabase/migrations/");
  process.exit(1);
}

console.log(`applying ${files.length} migration(s) to ${redact(dbUrl)}\n`);

try {
  for (const file of files) {
    const path = join(migrationsDir, file);
    const body = await readFile(path, "utf8");
    process.stdout.write(`▶ ${file} ... `);
    // postgres.unsafe handles multi-statement scripts when called via .simple()
    await sql.unsafe(body).simple();
    console.log("ok");
  }

  if (adminEmail) {
    console.log(`\n▶ seeding family.allowed_emails admin (${adminEmail}) ... `);
    await sql`
      insert into family.allowed_emails (email, role, branch)
      values (${adminEmail}, 'admin', 'both')
      on conflict (email) do update set role = 'admin', branch = 'both'
    `;
    console.log("  ok");
  } else {
    console.log("\n⚠ ADMIN_EMAIL not set — remember to insert a family.allowed_emails row before signup");
  }

  console.log("\n✓ all migrations applied");
} catch (err) {
  console.error("\n✗ migration failed:", err.message);
  if (err.position) console.error(`  near position ${err.position}`);
  if (err.where) console.error(`  ${err.where}`);
  process.exitCode = 1;
} finally {
  await sql.end({ timeout: 5 });
}

function redact(url) {
  try {
    const u = new URL(url);
    if (u.password) u.password = "***";
    return u.toString();
  } catch {
    return url;
  }
}
