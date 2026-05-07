/**
 * Read / write the key-value settings store. Public-safe values only —
 * server secrets stay in env. Cached in-memory for the lifetime of one
 * Astro server worker so per-request reads are cheap.
 *
 * Cache invalidation: setSetting / setMany clear the cache. Restart-on-
 * deploy is the natural backstop. For multi-instance deployments later,
 * swap the in-memory cache for a Supabase Realtime subscription.
 */
import { supabaseAdmin } from "./supabase/admin";

export type SettingCategory = "site" | "contact" | "integrations" | "appearance";

export type SettingRow = {
  key: string;
  value: string | null;
  category: SettingCategory;
  description: string | null;
  updated_at: string;
};

let cache: Map<string, string | null> | null = null;
let cacheLoadedAt = 0;
const CACHE_TTL_MS = 30 * 1000; // 30s — short enough that admin edits propagate quickly

async function loadCache(): Promise<Map<string, string | null>> {
  if (cache && Date.now() - cacheLoadedAt < CACHE_TTL_MS) return cache;
  const { data, error } = await supabaseAdmin
    .from("settings")
    .select("key, value");
  if (error) {
    // Don't crash the request on a settings read failure — log and
    // return an empty cache so callers fall back to defaults.
    console.error("settings: read failed", error.message);
    return new Map();
  }
  cache = new Map((data ?? []).map((r: any) => [r.key as string, (r.value ?? null) as string | null]));
  cacheLoadedAt = Date.now();
  return cache;
}

function invalidateCache() {
  cache = null;
  cacheLoadedAt = 0;
}

/** Single-key getter with explicit fallback. */
export async function getSetting(key: string, fallback = ""): Promise<string> {
  const c = await loadCache();
  const v = c.get(key);
  return (v ?? fallback) || fallback;
}

/** Bulk read for one category. Returns Record<key, value-or-empty>. */
export async function getCategory(category: SettingCategory): Promise<Record<string, string>> {
  const { data, error } = await supabaseAdmin
    .from("settings")
    .select("key, value")
    .eq("category", category);
  if (error) {
    console.error("settings: getCategory failed", error.message);
    return {};
  }
  const out: Record<string, string> = {};
  for (const r of data ?? []) {
    out[(r as any).key] = ((r as any).value ?? "") as string;
  }
  return out;
}

/** All settings, joined with metadata, for the admin form. */
export async function listSettings(): Promise<SettingRow[]> {
  const { data, error } = await supabaseAdmin
    .from("settings")
    .select("key, value, category, description, updated_at")
    .order("category", { ascending: true })
    .order("key", { ascending: true });
  if (error) throw new Error(`listSettings: ${error.message}`);
  return (data ?? []) as SettingRow[];
}

/** Update a single key. */
export async function setSetting(key: string, value: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("settings")
    .update({ value: value || null })
    .eq("key", key);
  if (error) throw new Error(`setSetting ${key}: ${error.message}`);
  invalidateCache();
}

/** Bulk update — used by the admin form on save. */
export async function setMany(values: Record<string, string>): Promise<void> {
  const entries = Object.entries(values);
  if (entries.length === 0) return;
  for (const [key, value] of entries) {
    const { error } = await supabaseAdmin
      .from("settings")
      .update({ value: value || null })
      .eq("key", key);
    if (error) throw new Error(`setMany ${key}: ${error.message}`);
  }
  invalidateCache();
}

/** Resolve "site identity" settings into the legacy SITE shape so
 *  existing pages can swap the import with one line. */
export type ResolvedSite = {
  surname: string;
  hometown: string;
  hometownEn: string;
  motto: string;
  mottoEn: string;
  established: number;
  defaultTheme: "classic" | "scroll" | "modern";
  monogram: string;
  brand: { vi: string; en: string };
};

export async function getSiteIdentity(): Promise<ResolvedSite> {
  const c = await loadCache();
  const v = (k: string, fallback: string) => (c.get(k) ?? null) || fallback;
  return {
    surname: v("site.surname", "Nguyễn"),
    hometown: v("site.hometown", "Tịnh Khê, Sơn Tịnh, Quảng Ngãi"),
    hometownEn: v("site.hometown_en", "Tinh Khe, Son Tinh, Quang Ngai"),
    motto: v("site.motto", "Uống nước nhớ nguồn"),
    mottoEn: v("site.motto_en", "Drink water, remember the source"),
    established: Number(v("site.established", "1928")) || 1928,
    defaultTheme: (v("appearance.default_theme", "classic") as ResolvedSite["defaultTheme"]),
    monogram: v("site.monogram", "N1928"),
    brand: {
      vi: v("site.brand_vi", "Gia đình họ Nguyễn"),
      en: v("site.brand_en", "The Nguyễn Family"),
    },
  };
}

/** Single Google Maps API key reader. Falls back to env for backward
 *  compat — once this admin setting is populated, the env var becomes
 *  optional. */
export async function getGoogleMapsApiKey(): Promise<string> {
  const fromDb = await getSetting("integrations.google_maps_api_key", "");
  if (fromDb) return fromDb;
  return import.meta.env.PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
}

/** Admin contact email — used by /admin/help + /admin/login + footer. */
export async function getAdminEmail(): Promise<string> {
  return getSetting("contact.admin_email", "hvtuan0311@gmail.com");
}
