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

export type SettingCategory =
  | "site"
  | "contact"
  | "integrations"
  | "appearance"
  | "seo"
  | "maps"
  | "privacy"
  | "social"
  | "analytics"
  | "smtp"
  | "hero";

export type SettingFieldType =
  | "text"
  | "password"
  | "textarea"
  | "number"
  | "boolean"
  | "url"
  | "color"
  | `select:${string}`;

export type SettingRow = {
  key: string;
  value: string | null;
  category: SettingCategory;
  description: string | null;
  field_type: SettingFieldType;
  sort_order: number;
  updated_at: string;
};

let cache: Map<string, string | null> | null = null;
let cacheLoadedAt = 0;
const CACHE_TTL_MS = 30 * 1000;

async function loadCache(): Promise<Map<string, string | null>> {
  if (cache && Date.now() - cacheLoadedAt < CACHE_TTL_MS) return cache;
  const { data, error } = await supabaseAdmin
    .from("settings")
    .select("key, value");
  if (error) {
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

export async function getSetting(key: string, fallback = ""): Promise<string> {
  const c = await loadCache();
  const v = c.get(key);
  return (v ?? fallback) || fallback;
}

export async function getBoolean(key: string, fallback = false): Promise<boolean> {
  const c = await loadCache();
  const v = c.get(key);
  if (v === null || v === undefined) return fallback;
  return v === "true" || v === "1" || v === "yes";
}

export async function getNumber(key: string, fallback = 0): Promise<number> {
  const c = await loadCache();
  const raw = c.get(key);
  if (raw === null || raw === undefined || raw === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

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

export async function listSettings(): Promise<SettingRow[]> {
  const { data, error } = await supabaseAdmin
    .from("settings")
    .select("key, value, category, description, field_type, sort_order, updated_at")
    .order("category", { ascending: true })
    .order("sort_order", { ascending: true })
    .order("key", { ascending: true });
  if (error) throw new Error(`listSettings: ${error.message}`);
  return (data ?? []) as SettingRow[];
}

export async function setSetting(key: string, value: string): Promise<void> {
  const { error } = await supabaseAdmin
    .from("settings")
    .update({ value: value || null })
    .eq("key", key);
  if (error) throw new Error(`setSetting ${key}: ${error.message}`);
  invalidateCache();
}

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
  tagline: { vi: string; en: string };
  faviconUrl: string;
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
    tagline: {
      vi: v("site.tagline_vi", ""),
      en: v("site.tagline_en", ""),
    },
    faviconUrl: v("site.favicon_url", "/favicon.svg"),
  };
}

export async function getGoogleMapsApiKey(): Promise<string> {
  const fromDb = await getSetting("integrations.google_maps_api_key", "");
  if (fromDb) return fromDb;
  return import.meta.env.PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
}

export async function getAdminEmail(): Promise<string> {
  return getSetting("contact.admin_email", "hvtuan0311@gmail.com");
}

export type SocialLinks = {
  facebookUrl: string;
  youtubeUrl: string;
  instagramUrl: string;
  zaloOA: string;
};

export async function getSocialLinks(): Promise<SocialLinks> {
  const c = await loadCache();
  const v = (k: string) => (c.get(k) ?? "") as string;
  return {
    facebookUrl: v("social.facebook_url"),
    youtubeUrl: v("social.youtube_url"),
    instagramUrl: v("social.instagram_url"),
    zaloOA: v("social.zalo_oa"),
  };
}

export type SeoMeta = {
  indexingEnabled: boolean;
  defaultDescription: string;
  ogImageUrl: string;
  twitterHandle: string;
};

export async function getSeoMeta(): Promise<SeoMeta> {
  return {
    indexingEnabled: await getBoolean("seo.indexing_enabled", false),
    defaultDescription: await getSetting("seo.default_description", ""),
    ogImageUrl: await getSetting("seo.og_image_url", ""),
    twitterHandle: await getSetting("seo.twitter_handle", ""),
  };
}

export type MapsDefaults = {
  lat: number;
  lng: number;
  zoom: number;
};

export async function getMapsDefaults(): Promise<MapsDefaults> {
  return {
    lat: await getNumber("maps.default_lat", 15.1213),
    lng: await getNumber("maps.default_lng", 108.8044),
    zoom: await getNumber("maps.default_zoom", 6),
  };
}

export type HeroDefaults = {
  defaultDurationMs: number;
  showLotusWhenEmpty: boolean;
  height: string;
};

export async function getHeroDefaults(): Promise<HeroDefaults> {
  return {
    defaultDurationMs: await getNumber("hero.default_duration_ms", 6000),
    showLotusWhenEmpty: await getBoolean("hero.show_lotus_when_empty", true),
    height: await getSetting("hero.height", "70vh"),
  };
}

export type PrivacyToggles = {
  showAdminLinkInFooter: boolean;
  showThemeSwitcher: boolean;
  lunarCalendarFirst: boolean;
};

export async function getPrivacyToggles(): Promise<PrivacyToggles> {
  return {
    showAdminLinkInFooter: await getBoolean("privacy.show_admin_link_in_footer", true),
    showThemeSwitcher: await getBoolean("privacy.show_theme_switcher", true),
    lunarCalendarFirst: await getBoolean("privacy.lunar_calendar_first", false),
  };
}

export type AnalyticsConfig = {
  umamiUrl: string;
  umamiSiteId: string;
  plausibleDomain: string;
  googleTagId: string;
};

export async function getAnalyticsConfig(): Promise<AnalyticsConfig> {
  return {
    umamiUrl: await getSetting("analytics.umami_url", ""),
    umamiSiteId: await getSetting("analytics.umami_site_id", ""),
    plausibleDomain: await getSetting("analytics.plausible_domain", ""),
    googleTagId: await getSetting("analytics.google_tag_id", ""),
  };
}
