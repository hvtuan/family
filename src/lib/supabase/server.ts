/**
 * Server-side Supabase client for Astro SSR pages and API endpoints.
 * Reads/writes auth cookies on the response so sessions survive across
 * requests. Always uses the anon key — RLS policies enforce permissions.
 *
 * For privileged operations that must bypass RLS (migrations, audit-log
 * queries from a cron, etc.), use lib/supabase/admin.ts instead.
 */

import type { AstroCookies } from "astro";
import { createServerClient, type CookieMethodsServer } from "@supabase/ssr";

const url = import.meta.env.PUBLIC_SUPABASE_URL;
const anonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
const schema = import.meta.env.PUBLIC_SUPABASE_SCHEMA || "family";

if (!url || !anonKey) {
  throw new Error(
    "Missing PUBLIC_SUPABASE_URL or PUBLIC_SUPABASE_ANON_KEY in env",
  );
}

/**
 * Build a server client bound to the current request's cookies.
 * Pass `Astro.cookies` and `Astro.request` from a `.astro` page or API
 * endpoint. Astro 6's `AstroCookies` lacks `getAll`, so we parse the request's
 * Cookie header for the read side.
 */
export function createSupabaseServerClient(
  cookies: AstroCookies,
  request: Request,
) {
  const cookieMethods: CookieMethodsServer = {
    getAll() {
      const header = request.headers.get("cookie") ?? "";
      if (!header) return [];
      return header.split(";").flatMap((part) => {
        const trimmed = part.trim();
        if (!trimmed) return [];
        const eq = trimmed.indexOf("=");
        if (eq === -1) return [{ name: trimmed, value: "" }];
        const name = trimmed.slice(0, eq).trim();
        const value = decodeURIComponent(trimmed.slice(eq + 1).trim());
        return [{ name, value }];
      });
    },
    setAll(items) {
      for (const { name, value, options } of items) {
        cookies.set(name, value, {
          ...options,
          httpOnly: true,
          secure: import.meta.env.PROD,
          sameSite: "lax",
          path: "/",
        });
      }
    },
  };

  return createServerClient(url, anonKey, {
    cookies: cookieMethods,
    db: { schema },
  });
}
