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

  vite: {
    plugins: [tailwindcss()]
  },

  integrations: [react()]
});