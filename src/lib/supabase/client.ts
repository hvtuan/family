/**
 * Browser-side Supabase client. Used inside React islands rendered under
 * /admin (e.g. forms, file pickers). Never imports the service role key.
 *
 * Auth state is shared with the server via cookies (set by createServerClient
 * in lib/supabase/server.ts), so calling `auth.getUser()` here returns the
 * same session that SSR pages saw on the request.
 *
 * The client is bound to the `family` schema so PostgREST routes table calls
 * (`from('members')`) to `family.members` rather than `public.members` — the
 * Supabase instance is shared with other projects.
 */

import { createBrowserClient } from "@supabase/ssr";

const url = import.meta.env.PUBLIC_SUPABASE_URL;
const anonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;
const schema = import.meta.env.PUBLIC_SUPABASE_SCHEMA || "family";

if (!url || !anonKey) {
  throw new Error(
    "Missing PUBLIC_SUPABASE_URL or PUBLIC_SUPABASE_ANON_KEY in env",
  );
}

export const supabase = createBrowserClient(url, anonKey, {
  db: { schema },
});
