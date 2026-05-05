/**
 * Server-side markdown → HTML for content fetched from the DB.
 * Replaces the `await render(entry)` Astro content-collection helper, which
 * is no longer applicable now that traditions/members bodies live in
 * Postgres.
 *
 * Renders synchronously via marked. The output is trusted (it comes from
 * editors with role `admin`/`editor` going through Sveltia-equivalent admin
 * UI in P5+; for now, only the seed migration writes it). If we ever start
 * rendering content authored by less-trusted roles, swap in DOMPurify
 * (server build) before injecting via `set:html`.
 */

import { marked } from "marked";

marked.use({
  gfm: true,
  breaks: false,
});

export function renderMarkdown(md: string | null | undefined): string {
  if (!md) return "";
  return marked.parse(md, { async: false }) as string;
}
