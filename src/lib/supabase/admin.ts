/**
 * Service-role Supabase client. BYPASSES RLS — use only in:
 *   - migration / seed scripts
 *   - SSR endpoints that need to do something the user shouldn't be able to
 *     express via their session (e.g. lookup an allowed_emails row before
 *     login completes)
 *   - the build pipeline reading content for prerender
 *
 * Never import this from client-side code or from a React island.
 * The service role key must NEVER appear in any code that runs in the browser.
 */

import { createClient } from "@supabase/supabase-js";

const url = process.env.PUBLIC_SUPABASE_URL ?? import.meta.env.PUBLIC_SUPABASE_URL;
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  // Astro `import.meta.env` only exposes vars to server code if they aren't
  // PUBLIC_*. Reading via process.env keeps it out of the client bundle.
  (import.meta.env as Record<string, string | undefined>).SUPABASE_SERVICE_ROLE_KEY;
const schema =
  process.env.PUBLIC_SUPABASE_SCHEMA ??
  import.meta.env.PUBLIC_SUPABASE_SCHEMA ??
  "family";

if (!url || !serviceKey) {
  throw new Error(
    "Missing PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env",
  );
}

export const supabaseAdmin = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
  db: { schema },
});
