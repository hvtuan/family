#!/usr/bin/env node
/**
 * Migrate timeline.image + traditions.image (text URL) → photo_id (FK).
 *
 *   pnpm db:migrate-image-to-photo            # dry run
 *   pnpm db:migrate-image-to-photo --apply
 *
 * For each row with a non-null .image string + a null .photo_id:
 *   1. Derive a photo id from the URL filename stem (lowercase, slug-safe).
 *      Falls back to `<entity>-<row_id>-cover` if filename unusable.
 *   2. If a family.photos row with that id already exists, link to it.
 *      Otherwise insert a new row with src = .image, caption = .title /
 *      .name (whichever the entity has), kind='image' (legacy), no
 *      variants (existing public URL stays as-is — no thumb/medium
 *      because we don't have the original bytes to reprocess server-side).
 *   3. Update the entity row's photo_id to point at the photos row.
 *
 * Idempotent: rows that already have photo_id set are skipped. Photos
 * created here get a marker via tag 'migrated-cover' so a later cleanup
 * pass could regenerate variants by re-uploading the original blob.
 *
 * The .image text column is NOT dropped — the next migration after this
 * succeeds in production handles that. Keeping it during transition
 * lets us roll back without data loss.
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

const SLUG_RE = /^[a-z0-9][a-z0-9._-]{0,60}$/;

function deriveId(src, fallback) {
  try {
    const u = new URL(src);
    const filename = u.pathname.split("/").pop() ?? "";
    const stem = filename.replace(/\.[^.]+$/, "").toLowerCase();
    if (SLUG_RE.test(stem)) return stem;
  } catch {
    // not a URL
  }
  return fallback;
}

// Fetch existing photos so we don't insert duplicates by src.
const { data: existingPhotos, error: peErr } = await db
  .from("photos").select("id, src");
if (peErr) {
  console.error("read photos failed:", peErr.message);
  process.exit(1);
}
const existingIdsSet = new Set(existingPhotos.map((p) => p.id));
const srcToId = new Map(existingPhotos.map((p) => [p.src, p.id]));

// Pull rows with .image set but .photo_id null for both entities.
const { data: timelineRows, error: tErr } = await db
  .from("timeline")
  .select("id, title, image, photo_id, year")
  .not("image", "is", null)
  .is("photo_id", null);
if (tErr) {
  console.error("read timeline failed:", tErr.message);
  process.exit(1);
}

const { data: tradRows, error: trErr } = await db
  .from("traditions")
  .select("id, name, image, photo_id")
  .not("image", "is", null)
  .is("photo_id", null);
if (trErr) {
  console.error("read traditions failed:", trErr.message);
  process.exit(1);
}

const planPhotos = [];
const planTimeline = [];     // [{ id, photo_id }]
const planTraditions = [];   // [{ id, photo_id }]

function ensurePhotoFor(srcUrl, fallbackId, caption, year) {
  // Re-use an existing photos row that already serves this src URL.
  const seen = srcToId.get(srcUrl);
  if (seen) return seen;

  // Derive a fresh id; collision guard if the slug is taken by an
  // unrelated row (rare).
  let id = deriveId(srcUrl, fallbackId);
  if (existingIdsSet.has(id)) {
    // If the existing row has a different src, suffix with -cover to
    // disambiguate (this means we have two photos with the same stem
    // but different blobs — uncommon but possible).
    let n = 2;
    while (existingIdsSet.has(`${id}-${n}`)) n++;
    id = `${id}-${n}`;
  }
  if (!SLUG_RE.test(id)) id = fallbackId;

  planPhotos.push({
    id,
    kind: "image",
    src: srcUrl,
    src_thumb: null,
    src_medium: null,
    caption: caption ?? id,
    caption_en: caption ?? id,
    year: year ?? null,
    featured: false,
    tags: ["migrated-cover"],
  });
  existingIdsSet.add(id);
  srcToId.set(srcUrl, id);
  return id;
}

for (const r of timelineRows ?? []) {
  const photoId = ensurePhotoFor(
    r.image,
    `timeline-${r.id}-cover`,
    r.title,
    r.year,
  );
  planTimeline.push({ id: r.id, photo_id: photoId });
}

for (const r of tradRows ?? []) {
  const photoId = ensurePhotoFor(
    r.image,
    `${r.id}-cover`,
    r.name,
    null,
  );
  planTraditions.push({ id: r.id, photo_id: photoId });
}

console.log("plan summary:");
console.log(`  + ${planPhotos.length} new family.photos rows`);
console.log(`  + ${planTimeline.length} timeline.photo_id updates`);
console.log(`  + ${planTraditions.length} traditions.photo_id updates`);
if (planPhotos.length) {
  console.log("\n  new photos:");
  for (const p of planPhotos) console.log(`    ${p.id}  ${p.src.slice(-60)}`);
}
if (planTimeline.length) {
  console.log("\n  timeline:");
  for (const t of planTimeline) console.log(`    timeline #${t.id} → ${t.photo_id}`);
}
if (planTraditions.length) {
  console.log("\n  traditions:");
  for (const t of planTraditions) console.log(`    ${t.id} → ${t.photo_id}`);
}

if (!apply) {
  console.log("\n(dry run — pass --apply to execute)");
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

for (const t of planTimeline) {
  const { error } = await db
    .from("timeline").update({ photo_id: t.photo_id }).eq("id", t.id);
  if (error) {
    console.error(`timeline ${t.id} update failed:`, error.message);
    process.exit(1);
  }
}
console.log(`updated ${planTimeline.length} timeline.photo_id`);

for (const t of planTraditions) {
  const { error } = await db
    .from("traditions").update({ photo_id: t.photo_id }).eq("id", t.id);
  if (error) {
    console.error(`traditions ${t.id} update failed:`, error.message);
    process.exit(1);
  }
}
console.log(`updated ${planTraditions.length} traditions.photo_id`);

// Verification: any timeline/tradition with .image but still null photo_id?
const { count: tStuck } = await db
  .from("timeline")
  .select("*", { count: "exact", head: true })
  .not("image", "is", null).is("photo_id", null);
const { count: trStuck } = await db
  .from("traditions")
  .select("*", { count: "exact", head: true })
  .not("image", "is", null).is("photo_id", null);

if (tStuck === 0 && trStuck === 0) {
  console.log("✓ no orphans — every .image row now has a photo_id");
} else {
  console.log(`⚠ orphans: timeline=${tStuck}, traditions=${trStuck}`);
}

console.log("done.");
