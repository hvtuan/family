#!/usr/bin/env node
/**
 * Fail the build if any CJK Unified Ideograph appears in source files.
 *
 * Project rule: family/gia phả site is Vietnamese — no chữ Hán in UI,
 * design assets, or page content. See feedback memory
 * `family_no_chinese_chars` and DESIGN-MEMORIAL.md decision D26.
 *
 * Allowed:
 *   - Files inside DESIGN*.md and docs/ (rule documentation cites the
 *     forbidden chars when explaining what is forbidden).
 *   - Generated build output (dist/, node_modules/).
 *
 * Scope:
 *   - src/**\/*.{astro,tsx,ts,jsx,js,svg,html,md}
 */
import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";

const ROOT = process.cwd();
const SCAN_ROOTS = ["src", "public"];
const EXTENSIONS = new Set([".astro", ".tsx", ".ts", ".jsx", ".js", ".svg", ".html", ".md"]);
const SKIP_DIRS = new Set(["node_modules", "dist", ".astro", ".git"]);

// CJK Unified Ideographs U+4E00-U+9FFF, plus Extension A U+3400-U+4DBF.
const CJK_RE = /[㐀-䶿一-鿿]/g;

const violations = [];

async function walk(dir) {
  const items = await readdir(dir, { withFileTypes: true });
  for (const item of items) {
    if (SKIP_DIRS.has(item.name)) continue;
    const path = join(dir, item.name);
    if (item.isDirectory()) {
      await walk(path);
    } else if (item.isFile()) {
      const ext = item.name.slice(item.name.lastIndexOf("."));
      if (!EXTENSIONS.has(ext)) continue;
      await scan(path);
    }
  }
}

async function scan(filePath) {
  const text = await readFile(filePath, "utf8");
  const matches = [...text.matchAll(CJK_RE)];
  if (matches.length === 0) return;
  const lines = text.split("\n");
  let cursor = 0;
  let lineNum = 1;
  for (const m of matches) {
    while (cursor + lines[lineNum - 1].length < m.index) {
      cursor += lines[lineNum - 1].length + 1;
      lineNum += 1;
    }
    violations.push({
      file: relative(ROOT, filePath),
      line: lineNum,
      char: m[0],
      context: lines[lineNum - 1].trim().slice(0, 100),
    });
  }
}

for (const root of SCAN_ROOTS) {
  try {
    const s = await stat(join(ROOT, root));
    if (s.isDirectory()) await walk(join(ROOT, root));
  } catch {
    // root doesn't exist yet — skip silently
  }
}

if (violations.length === 0) {
  console.log("✓ check-no-cjk: zero CJK characters in source");
  process.exit(0);
}

console.error(`✗ check-no-cjk: ${violations.length} CJK character(s) found`);
console.error("Family project rule: NO chữ Hán in src/ or public/.");
console.error("Replace with lotus motif, Quốc ngữ calligraphy, or remove.\n");
for (const v of violations.slice(0, 50)) {
  console.error(`  ${v.file}:${v.line}  '${v.char}'  ${v.context}`);
}
if (violations.length > 50) console.error(`  ...and ${violations.length - 50} more`);
process.exit(1);
