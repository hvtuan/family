/**
 * Lightweight i18n runtime — message catalog + locale resolution.
 *
 * Why a custom catalog instead of astro-i18next: we have ~50-100 keys,
 * a single Vietnamese default, and gradual EN expansion. A typed const
 * catalog gives autocomplete + build-time typo detection at zero
 * runtime cost.
 *
 * Locale resolution chain (getLocale):
 *   1. ?lang=vi|en query param      (one-shot override)
 *   2. cookie family_lang=vi|en     (persisted preference)
 *   3. 'vi'                         (default — site is VN-first)
 *
 * Localized<T> shape is also used by JSONB content fields
 * (incense_events.message, condolences.body, etc.) — pickLocale()
 * resolves them with vi-fallback.
 */
import { vi } from "./vi";
import { en } from "./en";

export type Locale = "vi" | "en";
export type Localized<T = string> = Partial<Record<Locale, T>>;

const catalogs = { vi, en } as const;

type Catalog = typeof vi;
type Path<T, Prefix extends string = ""> = {
  [K in keyof T & string]: T[K] extends Record<string, unknown>
    ? `${Prefix}${K}.${Path<T[K]>}`
    : `${Prefix}${K}`;
}[keyof T & string];

export type MessageKey = Path<Catalog>;

interface AstroLike {
  url: URL;
  cookies: { get: (name: string) => { value?: string } | undefined };
}

export function getLocale(astro: AstroLike): Locale {
  const q = astro.url.searchParams.get("lang");
  if (q === "vi" || q === "en") return q;
  const c = astro.cookies.get("family_lang")?.value;
  if (c === "vi" || c === "en") return c;
  return "vi";
}

export function setLocaleCookie(
  cookies: { set: (name: string, value: string, opts?: { path: string; maxAge: number }) => void },
  lang: Locale
): void {
  cookies.set("family_lang", lang, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365, // 1 year
  });
}

/**
 * Resolve a localized JSONB value with vi-fallback. Returns undefined if
 * neither the requested locale nor vi has a value (and no fallback was given).
 */
export function pickLocale<T>(
  v: Localized<T> | undefined | null,
  lang: Locale,
  fallback?: T
): T | undefined {
  if (!v) return fallback;
  const candidate = v[lang] ?? v.vi;
  if (candidate !== undefined && candidate !== null) return candidate;
  for (const val of Object.values(v)) {
    if (val !== undefined && val !== null) return val as T;
  }
  return fallback;
}

/**
 * Translate a key. Vars are interpolated as {var}.
 *
 * Missing-key behavior: returns the key string itself (e.g. "memorial.foo")
 * rather than crashing. This way new features don't break the UI before
 * the catalog catches up.
 */
export function t(key: MessageKey, lang: Locale = "vi", vars: Record<string, string | number> = {}): string {
  const tpl = lookup(catalogs[lang] as Record<string, unknown>, key) ?? lookup(catalogs.vi as Record<string, unknown>, key) ?? key;
  if (typeof tpl !== "string") return key;
  return tpl.replace(/\{(\w+)\}/g, (_match, name) => {
    const v = vars[name];
    return v === undefined ? `{${name}}` : String(v);
  });
}

function lookup(obj: Record<string, unknown>, dottedPath: string): string | undefined {
  let cur: unknown = obj;
  for (const part of dottedPath.split(".")) {
    if (typeof cur !== "object" || cur === null) return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return typeof cur === "string" ? cur : undefined;
}
