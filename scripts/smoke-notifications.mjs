#!/usr/bin/env node
/**
 * Phase 1 acceptance smoke for the notification system.
 *
 * Usage:
 *   BASE=https://family.huynhvantuan.net SECRET=$(cat /tmp/cron-secret.txt) \
 *     node scripts/smoke-notifications.mjs
 */
const base = process.env.BASE ?? "http://localhost:4321";
const secret = process.env.SECRET ?? "";

async function check(name, fn) {
  try {
    await fn();
    console.log(`✓ ${name}`);
  } catch (err) {
    console.error(`✗ ${name}`);
    console.error("  " + (err && err.message ? err.message : err));
    process.exitCode = 1;
  }
}

await check("retry endpoint requires bearer", async () => {
  const res = await fetch(`${base}/admin/cron/notifications-retry`, { method: "POST" });
  if (res.status !== 401) throw new Error(`expected 401, got ${res.status}`);
});

if (secret) {
  await check("retry endpoint authorized → 200 JSON ok", async () => {
    const res = await fetch(`${base}/admin/cron/notifications-retry`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}` },
    });
    if (!res.ok) throw new Error(`status ${res.status}`);
    const body = await res.json();
    if (body.ok !== true) throw new Error("ok!=true");
  });

  await check("purge endpoint authorized → 200 JSON ok", async () => {
    const res = await fetch(`${base}/admin/cron/notifications-purge`, {
      method: "POST",
      headers: { Authorization: `Bearer ${secret}` },
    });
    if (!res.ok) throw new Error(`status ${res.status}`);
  });
}

await check("unread endpoint without session → 401", async () => {
  const res = await fetch(`${base}/api/notifications/unread.json`);
  if (res.status !== 401) throw new Error(`expected 401, got ${res.status}`);
});

console.log("\nDone.");
