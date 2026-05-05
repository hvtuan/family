// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import react from '@astrojs/react';
import node from '@astrojs/node';

// https://astro.build/config
// Hybrid: pages are static by default; opt-in SSR via `export const prerender = false`.
// Used by /admin/** which requires sessions, DB queries, and server endpoints.
export default defineConfig({
  output: 'static',
  adapter: node({ mode: 'standalone' }),

  // Astro 6's default `security.checkOrigin` compares the Origin header to
  // the request's own URL. Behind a reverse proxy (Cloudflare → Traefik →
  // container on port 80), the container sees `http://localhost/...` while
  // the browser sends `https://family.huynhvantuan.net` as Origin → 403
  // "Cross-site POST form submissions are forbidden" on every form POST.
  // We rely on SameSite=Lax cookies (set by @supabase/ssr) for CSRF defense
  // instead, which doesn't have the proxy problem.
  security: { checkOrigin: false },

  vite: {
    plugins: [tailwindcss()]
  },

  integrations: [react()]
});