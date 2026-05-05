#!/usr/bin/env node
/**
 * P2 — migrate src/content/** Markdown + YAML files into family.* tables.
 *
 * Usage:
 *   node --env-file=.env.local scripts/migrate-content-to-db.mjs --dry-run
 *   node --env-file=.env.local scripts/migrate-content-to-db.mjs --apply
 *
 * What it does:
 *   1. Walks each collection in src/content/{members,timeline,traditions,
 *      photos,quotes,dates,locations}.
 *   2. Parses YAML / MD frontmatter (+ markdown body when present).
 *   3. Transforms field names camelCase -> snake_case + collisions
 *      (text -> text_vi, desc -> desc_text).
 *   4. Resolves `src` paths in member.photo, member.photos[], standalone
 *      photos collection. Uploads each unique image to Supabase Storage
 *      bucket `family-photos` under prefix `seed/<filename>` and replaces
 *      the src with the public URL.
 *   5. Two-pass for members: first INSERT all members with FK relations
 *      (father/mother/spouse) set to NULL, then UPDATE FKs in pass 2 once
 *      every member exists. Children list is materialised in
 *      family.member_children M2M.
 *   6. Idempotent: upsert by natural id where present; for timeline,
 *      quotes, dates (bigserial PK) upsert by `source_file`.
 *
 * Dry-run prints the planned operations + counts. Apply commits.
 */

import { readFile, readdir, stat } from "node:fs/promises";
import { extname, basename, join, resolve, dirname } from "node:path";
import postgres from "postgres";
import matter from "gray-matter";
import yaml from "js-yaml";
import mime from "mime-types";
import { createClient } from "@supabase/supabase-js";

// ── env ─────────────────────────────────────────────────────────────────────
const dbUrl = process.env.SUPABASE_DB_URL;
const supabaseUrl = process.env.PUBLIC_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
const apply = process.argv.includes("--apply");
const dryRun = !apply;

if (!dbUrl || !supabaseUrl || !serviceRole) {
  console.error(
    "✗ missing env: SUPABASE_DB_URL / PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY",
  );
  process.exit(1);
}

const repoRoot = new URL("../", import.meta.url).pathname;
const contentDir = join(repoRoot, "src", "content");
const photoBucket = "family-photos";
const photoPrefix = "seed";

const sql = postgres(dbUrl, {
  max: 1,
  prepare: false,
  idle_timeout: 5,
  connect_timeout: 30,
});
const supa = createClient(supabaseUrl, serviceRole, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// ── small helpers ───────────────────────────────────────────────────────────
const camelToSnake = (s) =>
  s.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();

const stableId = (filePath) =>
  basename(filePath).replace(/\.(md|ya?ml|json)$/i, "");

async function listFiles(dir, exts) {
  try {
    const all = await readdir(dir);
    return all
      .filter((f) => exts.includes(extname(f).toLowerCase()))
      .map((f) => join(dir, f))
      .sort();
  } catch {
    return [];
  }
}

async function parseFile(file) {
  const ext = extname(file).toLowerCase();
  const raw = await readFile(file, "utf8");
  if (ext === ".md") {
    const { data, content } = matter(raw);
    return { data, body: content.trim() };
  }
  if (ext === ".yaml" || ext === ".yml") {
    return { data: yaml.load(raw) ?? {}, body: null };
  }
  if (ext === ".json") {
    return { data: JSON.parse(raw), body: null };
  }
  throw new Error(`unsupported extension: ${ext}`);
}

const stats = {
  members: { read: 0, upsert: 0, fk_update: 0, m2m: 0 },
  timeline: { read: 0, upsert: 0, m2m: 0 },
  traditions: { read: 0, upsert: 0 },
  photos: { read: 0, upsert: 0, m2m: 0, uploaded: 0, skipped_uploads: 0 },
  quotes: { read: 0, upsert: 0 },
  dates: { read: 0, upsert: 0 },
  locations: { read: 0, upsert: 0, m2m: 0 },
};
const uploadedCache = new Map(); // source path -> public URL

// ── photo upload helper ─────────────────────────────────────────────────────
async function uploadPhoto(srcPath, fromFile) {
  // Resolve relative path from the YAML/MD file's directory
  const abs = resolve(dirname(fromFile), srcPath);
  if (uploadedCache.has(abs)) return uploadedCache.get(abs);

  let st;
  try {
    st = await stat(abs);
  } catch {
    console.warn(`  ⚠ photo not found on disk: ${abs}`);
    return srcPath; // keep original
  }
  if (!st.isFile()) return srcPath;

  const fname = basename(abs);
  const objectKey = `${photoPrefix}/${fname}`;
  const { data: pub } = supa.storage.from(photoBucket).getPublicUrl(objectKey);
  const publicUrl = pub.publicUrl;

  if (dryRun) {
    stats.photos.uploaded += 1;
    uploadedCache.set(abs, publicUrl);
    return publicUrl;
  }

  // Check if already uploaded
  const { data: existing } = await supa.storage
    .from(photoBucket)
    .list(photoPrefix, { search: fname });
  const alreadyExists = (existing ?? []).some((o) => o.name === fname);

  if (alreadyExists) {
    stats.photos.skipped_uploads += 1;
  } else {
    const buf = await readFile(abs);
    const contentType = mime.lookup(abs) || "application/octet-stream";
    const { error } = await supa.storage
      .from(photoBucket)
      .upload(objectKey, buf, {
        contentType,
        upsert: true,
      });
    if (error) {
      console.warn(`  ⚠ upload failed for ${fname}: ${error.message}`);
      return srcPath;
    }
    stats.photos.uploaded += 1;
  }
  uploadedCache.set(abs, publicUrl);
  return publicUrl;
}

// ── members (md, two-pass) ──────────────────────────────────────────────────
async function migrateMembers() {
  const files = await listFiles(join(contentDir, "members"), [".md"]);
  const records = [];
  for (const f of files) {
    const { data, body } = await parseFile(f);
    stats.members.read += 1;

    // Resolve photo paths
    let photoUrl = null;
    if (data.photo) photoUrl = await uploadPhoto(data.photo, f);

    let embeddedPhotos = [];
    if (Array.isArray(data.photos)) {
      embeddedPhotos = await Promise.all(
        data.photos.map(async (p) => ({
          src: await uploadPhoto(p.src, f),
          caption: p.caption,
          caption_en: p.captionEn ?? null,
          year: p.year ?? null,
        })),
      );
    }

    records.push({
      raw: data,
      file: f,
      body,
      photo: photoUrl,
      embedded_photos: embeddedPhotos,
    });
  }

  // Pass 1: insert all members with FK relations NULL
  for (const r of records) {
    const d = r.raw;
    const row = {
      id: d.id,
      name: d.name,
      name_en: d.nameEn ?? null,
      birth_name: d.birthName ?? null,
      nickname: d.nickname ?? null,
      gen: d.gen,
      role: d.role,
      role_en: d.roleEn ?? null,
      birth_order: d.birthOrder ?? null,
      is_family_head: d.isFamilyHead ?? false,
      born: d.born,
      lunar_born: d.lunarBorn ?? null,
      birth_place: d.birthPlace ?? null,
      died: d.died ?? null,
      lunar_died: d.lunarDied ?? null,
      death_place: d.deathPlace ?? null,
      death_anniversary: d.deathAnniversary ?? null,
      gravesite: d.gravesite ?? null,
      zodiac: d.zodiac ?? null,
      elemental_sign: d.elementalSign ?? null,
      bio: d.bio,
      bio_en: d.bioEn,
      body_md: r.body || null,
      location: d.location ?? null,
      job: d.job ?? null,
      job_en: d.jobEn ?? null,
      education: d.education ?? null,
      hobbies: d.hobbies ?? [],
      religion: d.religion ?? null,
      military: d.military ?? null,
      father_id: null, // pass 2
      mother_id: null,
      spouse_id: null,
      quote: d.quote ?? null,
      achievements: d.achievements ?? [],
      anecdotes: d.anecdotes ?? [],
      photo: r.photo,
      embedded_photos: r.embedded_photos,
      pattern: d.pattern ?? null,
      branch: d.branch ?? "both",
      contact_public: d.contactPublic ?? false,
      phone: d.phone ?? null,
      email: d.email ?? null,
      address: d.address ?? null,
      social: d.social ?? null,
      status: d.status ?? "published",
      tags: d.tags ?? [],
      updated_at_user: d.updatedAt ?? null,
    };

    if (dryRun) {
      stats.members.upsert += 1;
      continue;
    }
    await sql`
      insert into family.members ${sql(row, ...Object.keys(row))}
      on conflict (id) do update set ${sql(row, ...Object.keys(row).filter((k) => k !== "id"))}
    `;
    stats.members.upsert += 1;
  }

  // Pass 2: set FKs + materialise children M2M
  for (const r of records) {
    const d = r.raw;
    const fk = {
      father_id: d.father ?? null,
      mother_id: d.mother ?? null,
      spouse_id: d.spouse ?? null,
    };
    if (!dryRun) {
      await sql`
        update family.members set ${sql(fk, ...Object.keys(fk))}
        where id = ${d.id}
      `;
    }
    stats.members.fk_update += 1;

    if (Array.isArray(d.children) && d.children.length) {
      for (const child of d.children) {
        if (!dryRun) {
          await sql`
            insert into family.member_children (parent_id, child_id)
            values (${d.id}, ${child})
            on conflict do nothing
          `;
        }
        stats.members.m2m += 1;
      }
    }
  }
}

// ── timeline (yaml, bigserial PK + source_file) ─────────────────────────────
async function migrateTimeline() {
  const files = await listFiles(join(contentDir, "timeline"), [".yaml", ".yml", ".json"]);
  for (const f of files) {
    const { data: d } = await parseFile(f);
    stats.timeline.read += 1;
    const sf = stableId(f);
    const row = {
      year: d.year,
      date: d.date ?? null,
      lunar: d.lunar ?? false,
      title: d.title,
      title_en: d.titleEn,
      desc_text: d.desc,
      desc_en: d.descEn,
      category: d.category ?? null,
      image: d.image ?? null,
      source_file: sf,
    };

    if (dryRun) {
      stats.timeline.upsert += 1;
      if (Array.isArray(d.related)) stats.timeline.m2m += d.related.length;
      continue;
    }
    const inserted = await sql`
      insert into family.timeline ${sql(row, ...Object.keys(row))}
      on conflict (source_file) where source_file is not null
      do update set ${sql(row, ...Object.keys(row).filter((k) => k !== "source_file"))}
      returning id
    `;
    stats.timeline.upsert += 1;
    const tlId = inserted[0].id;

    if (Array.isArray(d.related)) {
      // wipe + reinsert M2M
      await sql`delete from family.timeline_members where timeline_id = ${tlId}`;
      for (const m of d.related) {
        await sql`
          insert into family.timeline_members (timeline_id, member_id)
          values (${tlId}, ${m}) on conflict do nothing
        `;
        stats.timeline.m2m += 1;
      }
    }
  }
}

// ── traditions (md, natural id from filename) ───────────────────────────────
async function migrateTraditions() {
  const files = await listFiles(join(contentDir, "traditions"), [".md"]);
  for (const f of files) {
    const { data: d, body } = await parseFile(f);
    stats.traditions.read += 1;

    const row = {
      id: stableId(f),
      name: d.name,
      name_en: d.nameEn,
      category: d.category ?? "food",
      icon: d.icon,
      desc_text: d.desc,
      desc_en: d.descEn,
      origin: d.origin ?? null,
      image: d.image ?? null,
      body_md: body || null,
      tags: d.tags ?? [],
    };
    if (dryRun) {
      stats.traditions.upsert += 1;
      continue;
    }
    await sql`
      insert into family.traditions ${sql(row, ...Object.keys(row))}
      on conflict (id) do update set ${sql(row, ...Object.keys(row).filter((k) => k !== "id"))}
    `;
    stats.traditions.upsert += 1;
  }
}

// ── photos (yaml, natural id from filename) ─────────────────────────────────
async function migratePhotos() {
  const files = await listFiles(join(contentDir, "photos"), [".yaml", ".yml", ".json"]);
  for (const f of files) {
    const { data: d } = await parseFile(f);
    stats.photos.read += 1;

    const srcUrl = await uploadPhoto(d.src, f);

    const row = {
      id: stableId(f),
      src: srcUrl,
      caption: d.caption,
      caption_en: d.captionEn,
      year: d.year ?? null,
      date: d.date ?? null,
      location: d.location ?? null,
      album: d.album ?? null,
      featured: d.featured ?? false,
    };
    if (dryRun) {
      stats.photos.upsert += 1;
      if (Array.isArray(d.related)) stats.photos.m2m += d.related.length;
      continue;
    }
    await sql`
      insert into family.photos ${sql(row, ...Object.keys(row))}
      on conflict (id) do update set ${sql(row, ...Object.keys(row).filter((k) => k !== "id"))}
    `;
    stats.photos.upsert += 1;

    if (Array.isArray(d.related)) {
      await sql`delete from family.photo_members where photo_id = ${row.id}`;
      for (const m of d.related) {
        await sql`
          insert into family.photo_members (photo_id, member_id)
          values (${row.id}, ${m}) on conflict do nothing
        `;
        stats.photos.m2m += 1;
      }
    }
  }
}

// ── quotes (yaml, bigserial PK + source_file) ───────────────────────────────
async function migrateQuotes() {
  const files = await listFiles(join(contentDir, "quotes"), [".yaml", ".yml", ".json"]);
  for (const f of files) {
    const { data: d } = await parseFile(f);
    stats.quotes.read += 1;
    const row = {
      text_vi: d.text,
      text_en: d.textEn ?? null,
      author: d.author,
      author_ref: d.authorRef ?? null,
      type: d.type ?? "family",
      context: d.context ?? null,
      source_file: stableId(f),
    };
    if (dryRun) {
      stats.quotes.upsert += 1;
      continue;
    }
    await sql`
      insert into family.quotes ${sql(row, ...Object.keys(row))}
      on conflict (source_file) where source_file is not null
      do update set ${sql(row, ...Object.keys(row).filter((k) => k !== "source_file"))}
    `;
    stats.quotes.upsert += 1;
  }
}

// ── dates (yaml, bigserial PK + source_file) ────────────────────────────────
async function migrateDates() {
  const files = await listFiles(join(contentDir, "dates"), [".yaml", ".yml", ".json"]);
  for (const f of files) {
    const { data: d } = await parseFile(f);
    stats.dates.read += 1;
    const row = {
      date: d.date,
      calendar: d.calendar ?? "solar",
      name: d.name,
      name_en: d.nameEn,
      type: d.type,
      member_id: d.member ?? null,
      year: d.year ?? null,
      recurring: d.recurring ?? true,
      notes: d.notes ?? null,
      source_file: stableId(f),
    };
    if (dryRun) {
      stats.dates.upsert += 1;
      continue;
    }
    await sql`
      insert into family.dates ${sql(row, ...Object.keys(row))}
      on conflict (source_file) where source_file is not null
      do update set ${sql(row, ...Object.keys(row).filter((k) => k !== "source_file"))}
    `;
    stats.dates.upsert += 1;
  }
}

// ── locations (yaml, natural id) ────────────────────────────────────────────
async function migrateLocations() {
  const files = await listFiles(join(contentDir, "locations"), [".yaml", ".yml", ".json"]);
  for (const f of files) {
    const { data: d } = await parseFile(f);
    stats.locations.read += 1;
    const row = {
      id: d.id,
      name: d.name,
      name_en: d.nameEn,
      province: d.province,
      lat: d.coords?.lat,
      lng: d.coords?.lng,
      is_hometown: d.isHometown ?? false,
      description: d.description ?? null,
    };
    if (dryRun) {
      stats.locations.upsert += 1;
      if (Array.isArray(d.members)) stats.locations.m2m += d.members.length;
      continue;
    }
    await sql`
      insert into family.locations ${sql(row, ...Object.keys(row))}
      on conflict (id) do update set ${sql(row, ...Object.keys(row).filter((k) => k !== "id"))}
    `;
    stats.locations.upsert += 1;

    if (Array.isArray(d.members)) {
      await sql`delete from family.location_members where location_id = ${row.id}`;
      for (const m of d.members) {
        await sql`
          insert into family.location_members (location_id, member_id)
          values (${row.id}, ${m}) on conflict do nothing
        `;
        stats.locations.m2m += 1;
      }
    }
  }
}

// ── orchestrate ─────────────────────────────────────────────────────────────
console.log(`\nmode: ${dryRun ? "DRY-RUN (no writes)" : "APPLY"}`);
console.log(`db:   ${redact(dbUrl)}`);
console.log(`bucket: ${photoBucket} (prefix: ${photoPrefix}/)\n`);

try {
  // Order matters: members first (others FK to members), then the rest.
  console.log("▶ members …");        await migrateMembers();
  console.log("▶ traditions …");     await migrateTraditions();
  console.log("▶ photos …");         await migratePhotos();
  console.log("▶ timeline …");       await migrateTimeline();
  console.log("▶ quotes …");         await migrateQuotes();
  console.log("▶ dates …");          await migrateDates();
  console.log("▶ locations …");      await migrateLocations();

  console.log("\n=== summary ===");
  for (const [k, v] of Object.entries(stats)) {
    console.log(`  ${k}:`, v);
  }
  if (dryRun) {
    console.log(
      "\nDry-run complete. Re-run with --apply to write to the database.",
    );
  } else {
    console.log("\n✓ apply complete");
  }
} catch (err) {
  console.error("\n✗ migration failed:", err.message);
  if (err.stack) console.error(err.stack);
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
