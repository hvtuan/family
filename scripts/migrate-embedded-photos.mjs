#!/usr/bin/env node
/**
 * Migrate every entry in members.embedded_photos[] into a row in
 * family.photos plus a photo_members link.
 *
 * Usage:
 *   pnpm db:migrate-embedded            # dry run
 *   pnpm db:migrate-embedded --apply
 *
 * Idempotent: a photo id already in family.photos is left alone, and
 * a photo_members link already present is skipped via composite-PK
 * upsert. Re-running is safe.
 *
 * Photo id derivation: filename stem from the src URL (e.g.
 * `…/seed/g3-1-graduation.svg` → `g3-1-graduation`). If the URL has no
 * usable filename, falls back to `<member_id>-photo-<index>`.
 *
 * After this commit lands, members.embedded_photos is no longer read by
 * the public site (content.ts switches to photo_members M2M). The
 * column itself is dropped in the next commit (0009 migration).
 */

import { createClient } from "@supabase/supabase-js";

const apply = process.argv.includes("--apply");

const url = process.env.PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Missing PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const db = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  db: { schema: "family" },
});

function deriveId(src, memberId, idx) {
  try {
    const u = new URL(src);
    const filename = u.pathname.split("/").pop() ?? "";
    const stem = filename.replace(/\.[^.]+$/, "");
    if (/^[a-z0-9][a-z0-9._-]{0,60}$/i.test(stem)) return stem.toLowerCase();
  } catch {
    /* not a URL — fall through */
  }
  return `${memberId}-photo-${idx + 1}`;
}

const { data: members, error: memErr } = await db
  .from("members")
  .select("id, name, embedded_photos")
  .order("id");
if (memErr) {
  console.error("read members failed:", memErr.message);
  process.exit(1);
}

const { data: existingPhotos } = await db.from("photos").select("id");
const existingIds = new Set((existingPhotos ?? []).map((p) => p.id));

const { data: existingLinks } = await db
  .from("photo_members")
  .select("photo_id, member_id");
const linkKey = (p, m) => `${p}|${m}`;
const existingLinkSet = new Set(
  (existingLinks ?? []).map((l) => linkKey(l.photo_id, l.member_id)),
);

const planPhotos = [];
const planLinks = [];

for (const m of members ?? []) {
  const arr = Array.isArray(m.embedded_photos) ? m.embedded_photos : [];
  for (let i = 0; i < arr.length; i++) {
    const p = arr[i];
    if (!p?.src) continue;
    const id = deriveId(p.src, m.id, i);
    if (!existingIds.has(id)) {
      planPhotos.push({
        id,
        src: p.src,
        caption: p.caption ?? "",
        caption_en: p.caption_en ?? p.caption ?? "",
        year: p.year ?? null,
        date: null,
        location: null,
        album: null,
        featured: false,
      });
      existingIds.add(id);
    }
    if (!existingLinkSet.has(linkKey(id, m.id))) {
      planLinks.push({ photo_id: id, member_id: m.id });
      existingLinkSet.add(linkKey(id, m.id));
    }
  }
}

console.log(`plan: ${planPhotos.length} new family.photos rows, ${planLinks.length} new photo_members links`);
for (const p of planPhotos) console.log(`  + photo  ${p.id}  "${p.caption}"`);
for (const l of planLinks) console.log(`  + link   ${l.photo_id} → ${l.member_id}`);

if (!apply) {
  console.log("");
  console.log("(dry run — pass --apply to execute)");
  process.exit(0);
}

if (planPhotos.length > 0) {
  const { error } = await db.from("photos").insert(planPhotos);
  if (error) {
    console.error("photos insert failed:", error.message);
    process.exit(1);
  }
  console.log(`inserted ${planPhotos.length} photos`);
}
if (planLinks.length > 0) {
  const { error } = await db.from("photo_members").insert(planLinks);
  if (error) {
    console.error("photo_members insert failed:", error.message);
    process.exit(1);
  }
  console.log(`inserted ${planLinks.length} links`);
}

console.log("done.");
