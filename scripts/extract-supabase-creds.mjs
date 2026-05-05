#!/usr/bin/env node
/**
 * Read Supabase credentials directly from running Coolify-managed containers
 * via `docker inspect`. Coolify keeps env values out of its API responses, so
 * this is the most reliable way to grab them post-deploy.
 *
 * Usage:
 *   node scripts/extract-supabase-creds.mjs <coolify-service-uuid>
 *
 * On success, prints a shell-sourceable block of the relevant env vars and
 * (optionally) updates .env.local in place.
 */

import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const svcUuid = process.argv[2];
if (!svcUuid) {
  console.error("usage: extract-supabase-creds.mjs <coolify-service-uuid>");
  process.exit(2);
}

// Coolify names containers like `supabase-db-<svcUuid>`, `supabase-kong-<svcUuid>`, etc.
const targets = ["db", "kong", "auth", "rest"];

function dockerEnv(containerName) {
  const r = spawnSync(
    "docker",
    ["inspect", "-f", "{{range .Config.Env}}{{println .}}{{end}}", containerName],
    { encoding: "utf8" },
  );
  if (r.status !== 0) return null;
  const env = {};
  for (const line of r.stdout.split("\n")) {
    const eq = line.indexOf("=");
    if (eq > 0) env[line.slice(0, eq)] = line.slice(eq + 1);
  }
  return env;
}

function dockerIp(containerName, network) {
  const r = spawnSync(
    "docker",
    [
      "inspect",
      "-f",
      `{{(index .NetworkSettings.Networks "${network}").IPAddress}}`,
      containerName,
    ],
    { encoding: "utf8" },
  );
  return r.status === 0 ? r.stdout.trim() : "";
}

function findContainer(suffix) {
  const r = spawnSync(
    "docker",
    ["ps", "--filter", `name=supabase-${suffix}-${svcUuid}`, "--format", "{{.Names}}"],
    { encoding: "utf8" },
  );
  return r.stdout.trim().split("\n").filter(Boolean)[0];
}

const found = {};
for (const t of targets) {
  found[t] = findContainer(t);
}

if (!found.db) {
  console.error(`✗ supabase-db container for service ${svcUuid} not found`);
  console.error("  is the service running? `docker ps | grep supabase`");
  process.exit(1);
}

const dbEnv = dockerEnv(found.db) ?? {};
const kongEnv = found.kong ? (dockerEnv(found.kong) ?? {}) : {};
const restEnv = found.rest ? (dockerEnv(found.rest) ?? {}) : {};

// Pick whichever has the key
function pick(...sources) {
  return (key) => {
    for (const s of sources) if (s && s[key]) return s[key];
    return undefined;
  };
}
const get = pick(kongEnv, restEnv, dbEnv);

const POSTGRES_PASSWORD = get("POSTGRES_PASSWORD");
const ANON_KEY = get("ANON_KEY") ?? get("SUPABASE_ANON_KEY");
const SERVICE_KEY = get("SERVICE_ROLE_KEY") ?? get("SUPABASE_SERVICE_ROLE_KEY") ?? get("SERVICE_KEY");
const JWT_SECRET = get("JWT_SECRET");
const PUBLIC_URL = get("SUPABASE_PUBLIC_URL") ?? get("API_EXTERNAL_URL");
const POSTGRES_DB = get("POSTGRES_DB") ?? "postgres";

// Inspect the docker network of supabase-db to find the right internal hostname
const netRaw = spawnSync(
  "docker",
  ["inspect", "-f", "{{range $k,$v := .NetworkSettings.Networks}}{{$k}}{{end}}", found.db],
  { encoding: "utf8" },
);
const network = netRaw.stdout.trim().split(/\s+/).filter(Boolean)[0];
const dbIp = dockerIp(found.db, network);

const out = {
  PUBLIC_SUPABASE_URL: PUBLIC_URL,
  PUBLIC_SUPABASE_ANON_KEY: ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY: SERVICE_KEY,
  SUPABASE_JWT_SECRET: JWT_SECRET,
  // Postgres connection: use the container's bridge IP from host.
  // 5432 is the default supavisor/postgres port inside the container.
  SUPABASE_DB_URL: `postgres://supabase_admin:${encodeURIComponent(POSTGRES_PASSWORD ?? "")}@${dbIp}:5432/${POSTGRES_DB}`,
  PUBLIC_SUPABASE_SCHEMA: "family",
};

console.log("# extracted Supabase credentials (do NOT paste in chat)");
console.log("# containers:", Object.entries(found).map(([k, v]) => `${k}=${v ?? "<missing>"}`).join(" "));
for (const [k, v] of Object.entries(out)) {
  console.log(`${k}=${v ?? ""}`);
}

// If --write flag and .env.local exists, splice values in.
if (process.argv.includes("--write")) {
  const path = ".env.local";
  let contents = existsSync(path) ? readFileSync(path, "utf8") : "";
  for (const [k, v] of Object.entries(out)) {
    if (v == null) continue;
    const safe = String(v).replace(/\n/g, "\\n");
    const re = new RegExp(`^${k}=.*$`, "m");
    if (re.test(contents)) {
      contents = contents.replace(re, `${k}=${safe}`);
    } else {
      contents += `\n${k}=${safe}`;
    }
  }
  if (!contents.endsWith("\n")) contents += "\n";
  writeFileSync(path, contents);
  console.log(`\n✓ updated ${path}`);
}
