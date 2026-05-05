#!/usr/bin/env node
/**
 * Privacy scan: ensure no `phone` / `email` / `address` / social URL of any
 * member with `contactPublic !== true` ends up in the static `dist/` output.
 *
 * Run after `pnpm build`. Exits non-zero on any leak.
 */
import { readdir, readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const MEMBERS_DIR = join(ROOT, "src/content/members");
const DIST_DIR = join(ROOT, "dist");

const TEXT_EXTS = /\.(html|js|css|json|map|svg|txt|xml)$/i;

function parseFrontmatter(text) {
  const m = text.match(/^---\r?\n([\s\S]+?)\r?\n---/);
  if (!m) return {};
  const out = {};
  let currentArrayKey = null;
  let inSocial = false;
  const social = {};
  for (const rawLine of m[1].split(/\r?\n/)) {
    if (!rawLine.trim()) continue;
    if (/^social:\s*$/.test(rawLine)) {
      inSocial = true;
      continue;
    }
    if (inSocial && /^  \w+:/.test(rawLine)) {
      const [k, v] = rawLine.trim().split(/:\s*/);
      social[k] = v?.replace(/^["']|["']$/g, "");
      continue;
    }
    inSocial = false;
    const kv = rawLine.match(/^(\w+):\s*(.*)$/);
    if (kv) {
      out[kv[1]] = kv[2].replace(/^["']|["']$/g, "");
      currentArrayKey = null;
    }
  }
  if (Object.keys(social).length) out.social = social;
  return out;
}

async function readMembers() {
  const files = await readdir(MEMBERS_DIR);
  const members = [];
  for (const f of files) {
    if (!f.endsWith(".md")) continue;
    const text = await readFile(join(MEMBERS_DIR, f), "utf8");
    const fm = parseFrontmatter(text);
    members.push({ id: f.replace(/\.md$/, ""), ...fm });
  }
  return members;
}

async function walk(dir) {
  const out = [];
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p)));
    else if (e.isFile() && TEXT_EXTS.test(e.name)) out.push(p);
  }
  return out;
}

function isPrivate(m) {
  return !(m.contactPublic === "true" || m.contactPublic === true);
}

const members = await readMembers();
const distFiles = await walk(DIST_DIR);

const fileContents = new Map();
for (const f of distFiles) {
  fileContents.set(f, await readFile(f, "utf8").catch(() => ""));
}

const violations = [];
let scanned = 0;

for (const m of members) {
  if (!isPrivate(m)) continue;
  const checks = [];
  for (const field of ["phone", "email", "address"]) {
    if (m[field]) checks.push({ field, value: m[field] });
  }
  if (m.social && typeof m.social === "object") {
    for (const k of Object.keys(m.social)) {
      const v = m.social[k];
      if (v) checks.push({ field: `social.${k}`, value: v });
    }
  }
  for (const c of checks) {
    scanned++;
    for (const [path, content] of fileContents) {
      if (content.includes(c.value)) {
        violations.push({
          memberId: m.id,
          field: c.field,
          value: c.value,
          file: path.replace(ROOT + "/", ""),
        });
      }
    }
  }
}

const tag = "[privacy-scan]";
console.log(
  `${tag} ${members.length} members, ${distFiles.length} files in dist, ${scanned} private values checked`,
);

if (violations.length === 0) {
  console.log(`${tag} ✓ no contact fields leaked.`);
  process.exit(0);
}

console.error(`${tag} ✗ ${violations.length} leak(s):`);
for (const v of violations) {
  console.error(
    `  ${v.memberId}.${v.field} = "${v.value}" found in ${v.file}`,
  );
}
process.exit(1);
