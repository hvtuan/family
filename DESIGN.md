# Family — Design Document

> Vietnamese multi-generation family showcase, ported from Claude Design HTML prototype to production-grade Astro site.

**Status**: Phase 1 — file-based content + static deploy. Phase 2 (later) — bolt-on Decap/Sveltia CMS.

---

## 1. Understanding Summary

| What | A 9-page Astro static site introducing a Vietnamese family ("Gia đình họ Nguyễn", Tịnh Khê, Quảng Ngãi). Recreated pixel-perfect from HTML prototype. |
| Why | Preserve and present family genealogy across generations; data-swappable for any family. |
| Who | Multi-generational Vietnamese families (elderly grandparents through young grandchildren) plus overseas relatives reading Vietnamese + English. |
| How | Astro 6 + TypeScript + Tailwind v4 + React islands + Content Collections (markdown + Zod). |
| Where | Coolify self-hosted + Cloudflare Tunnel; static build served via Nginx container. |
| Privacy | Public URL with `noindex` meta + no public sitemap. |
| Quality bar | WCAG AA, mobile-first, family-tree pan/zoom on touch + mouse, font scaling, `prefers-reduced-motion`. |

---

## 2. Decision Log

| # | Decision | Alternatives considered | Why |
|---|---|---|---|
| 1 | Astro 6 + React islands | Vite-React SPA, Next.js, Astro pure (no React), HTML+Babel | Static-first matches content-heavy site; only hydrate where JS is needed |
| 2 | Implement all 9 pages | Core 5, Minimal 3 | Each page contributes; calendar + map are emotional touchpoints for Vietnamese genealogy |
| 3 | Content Collections (markdown + Zod) | Hardcode TS, Local override file, Headless CMS now | Maintainable, schema-validated, editable by non-coders |
| 4 | Bilingual inline (VI + EN on same page) | Route-based i18n, Toggle switch, VI-only | Audience needs both simultaneously; deploy stays single set of routes |
| 5 | Hybrid photos: optional real + pattern fallback | All-placeholder, All-real-required, AI-generated | Astro Image optimizes when present; pattern degrades gracefully when absent |
| 6 | 3-theme switcher persistent (Classic / Scroll / Modern) | No switcher, Single theme, Dark mode toggle | CSS vars already exist in prototype; "personality" of design |
| 7 | Project path `/home/mininja/Github/family` | home, Documents, projects/ | User selection |
| 8 | Coolify self-host + Cloudflare Tunnel | Vercel, CF Pages, GH Pages, local-only | User-owned infra; full data control |
| 9 | Public URL + `noindex` | Fully public, basic auth, private LAN | Easy share without Google indexing |
| 10 | Full a11y + responsive | Basic responsive only, Desktop-only | Audience includes elderly + mobile-only users |
| 11 | Phase 1 file-based; Phase 2 Decap/Sveltia | Headless CMS now, Tina visual editor | Ship faster; admin schema mapped already |
| 12 | Tailwind v4 (CSS-first @theme) | Tailwind v3, vanilla CSS | Single source of design tokens; tree-shaking; React + Astro share utilities |

---

## 3. Architecture

### Directory layout

```
family/
├── src/
│   ├── content/
│   │   ├── config.ts                    # Zod schemas (7 collections)
│   │   ├── members/                     # 1 .md per person
│   │   ├── timeline/ traditions/ photos/
│   │   ├── quotes/ dates/ locations/
│   ├── data/
│   │   └── site.ts                      # SITE config + NAV_LINKS
│   ├── components/
│   │   ├── astro/                       # Static UI, no JS
│   │   │   ├── layout/ motifs/ cards/ data/ map/
│   │   └── react/                       # Islands
│   │       ├── FamilyTree/
│   │       ├── MemberModal/
│   │       ├── ThemeSwitcher.tsx
│   │       └── MemberFilter.tsx
│   ├── layouts/
│   │   └── Base.astro                   # html shell, fonts, theme bootstrap
│   ├── pages/                           # 9 route files
│   ├── lib/utils.ts                     # cn helper
│   ├── stores/ui.ts                     # nanostores
│   └── styles/global.css                # @theme tokens + utilities + theme variants
├── public/fonts/                        # 7 woff2 self-hosted
├── public/textures/paper-noise.svg
├── Dockerfile                           # multi-stage: node build → nginx serve
├── nginx.conf
├── DEPLOY.md  PHASE-2-ADMIN.md  README.md
└── astro.config.mjs  tsconfig.json  package.json
```

### Hydration strategy

| Page | Client islands | Estimated JS gzip |
|---|---|---|
| `/` | ThemeSwitcher | ~5KB + 25KB (modal infra) |
| `/family-tree` | FamilyTree (`client:load`) | ~50KB |
| `/members` | MemberFilter (`client:visible`) | ~30KB |
| `/timeline` `/album` `/traditions` `/sayings` `/map` `/calendar` | (modal singleton only) | ~25KB |

Modal is rendered once in `Base.astro` and opened from any page via `$modalMember.set(id)`.

---

## 4. Content Schema (Section 1 of brainstorm — full reference)

See `src/content/config.ts` for source of truth. Highlights:

- **members** (`type: 'content'`): identity, classification, lifecycle (solar + lunar), cultural ID (zodiac + ngũ hành), bio short + body markdown long, profile, references (`father`, `mother`, `spouse`, `children`), voice & stories, visuals, contact (gated by `contactPublic`), admin metadata.
- **timeline** (`type: 'data'`): year + optional date + lunar flag, bilingual title/desc, category, related members, optional image.
- **traditions** (`type: 'content'`): name + bilingual desc, category (food/festival/ceremony/craft), icon enum, body markdown for recipe/details.
- **photos**, **quotes**, **dates**, **locations**: typed records with refs to members.

All `reference('members')` is build-time validated — broken IDs fail the build.

---

## 5. Family Tree Island (Section 3 of brainstorm)

- **Layout**: 4 generations × horizontal rows; couples placed with 80px gap; children center-align under couple midpoint.
- **Connectors**: SVG paths (not CSS pseudo-elements — proven failure mode in prototype).
- **Pan/zoom**: Pointer Events API unifying mouse + touch + stylus; pinch-zoom with two pointers around midpoint; bounds `scale ∈ [0.3, 2.0]`; buttons +/−/Fit/1:1.
- **Click vs drag disambiguation**: pointer-move distance > 5px ⇒ skip click.
- **Generation labels**: left-anchored with paper background and vermilion border, `z-index: 20` above SVG (z=1) and cards (z=2).
- **A11y**: card = `<button>` focusable; `role="tree"` on stage; `role="treeitem"` with `aria-level={gen}`; live region announces zoom level.
- **Mobile**: smaller cards, gesture hint text differs; auto fit-to-screen on mount.

---

## 6. Member Modal Island (Section 4 of brainstorm)

- **Mount**: singleton in `Base.astro` (`client:load`), opened via nanostore `$modalMember`.
- **Tabs**: Tiểu sử / Ảnh / Giai thoại / Thành tích / Quan hệ / Liên lạc (last gated by `contactPublic`).
- **Slideshow**: `embla-carousel-react`, keyboard arrows, dot nav, lazy images.
- **Relations tab**: cha/mẹ/vợ-chồng/con cards — clicking swaps modal content (no close).
- **URL deep-link**: `?member=g1-1` syncs both directions; back button closes modal.
- **A11y**: Radix Dialog handles focus trap + ESC + return-focus.
- **Sensitive data**: build-time strip phone/email/address from non-`contactPublic` members before serializing into bundle.

---

## 7. Tailwind v4 + Theme System (Section 5 of brainstorm)

- **CSS-first config** via `@theme` directive in `src/styles/global.css`.
- **Theme variants** via `[data-theme="scroll" | "modern"]` selector overriding CSS vars; Tailwind utilities (`bg-paper`, `text-vermilion`) automatically pick up new values through `var()`.
- **FOUC prevention**: inline `<script is:inline>` in `<head>` reads `localStorage.theme` and sets `documentElement.dataset.theme` before paint.
- **Self-hosted fonts**: 5 woff2 files in `public/fonts/`; `font-display: swap`; Vietnamese unicode-range subset.
- **Custom utilities** in `@layer utilities`: `u-kicker`, `u-script`, `u-seal`, `u-card`, `u-paper-bg`, `u-reveal` — visual primitives only; layout composition stays in markup classes.
- **Custom breakpoints**: `mobile (480) tablet (768) desktop (1024) wide (1240)`.

---

## 8. Page Mapping (Section 6 of brainstorm)

URL paths (English; content text bilingual):

| URL | Collection inputs | Astro components | React islands |
|---|---|---|---|
| `/` | members (preview), quotes, timeline (preview) | Hero, Seal, Stamp, HeroQuote, StatsBanner, BlossomDivider, MemberCard | (modal singleton) |
| `/family-tree` | members (full) | PageHead | **FamilyTree** |
| `/members` | members (full) | PageHead, MemberCard | **MemberFilter** |
| `/timeline` | timeline, members (related) | PageHead, TimelineEvent | — |
| `/album` | photos | PageHead, PhotoCard | — |
| `/traditions` | traditions | PageHead, TraditionCard, Lotus | — |
| `/sayings` | quotes | PageHead, QuoteCard | — |
| `/map` | locations, members | PageHead, VietnamSVG, LocationMarker | — |
| `/calendar` | dates, members | PageHead, DateCard | — |

---

## 9. Build & Deploy (Section 7 of brainstorm)

- **Local dev**: `pnpm dev` → http://localhost:4321
- **Build**: `pnpm build` (runs `astro check` then `astro build`, outputs `dist/`)
- **Docker**: multi-stage Node build → Nginx Alpine static serve, healthcheck `/`
- **Coolify**: New Application from GitHub repo, build pack Dockerfile, attach Cloudflare Tunnel hostname
- See `DEPLOY.md` for step-by-step

---

## 10. Phase-2 Admin Migration

When non-technical family members need to edit data without touching git:

1. Drop in Sveltia CMS (`public/admin/index.html` + `public/admin/config.yml`)
2. Map collections to widgets (relation, image, list, datetime, select)
3. Cloudflare Worker for GitHub OAuth callback (~30 lines)
4. Repo collaborators only get edit access

Schema and folder structure already match Decap/Sveltia conventions — zero refactor required.
See `PHASE-2-ADMIN.md`.

---

## 11. Risks & Mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| Lora missing rare Hán-Nôm glyphs | M | Fallback chain `Lora → Be Vietnam Pro → Noto Serif`; test with real content. |
| Pinch-zoom buggy on iOS Safari | M | Pointer Events tested early; CSS `touch-action: none` on tree stage. |
| Build slow with many photos | L | Astro Image cache; phase-2 CDN offload if needed. |
| Tunnel down → site offline | L | CF Tunnel HA built-in; document fallback. |
| Reference deleted while still used | M-H | Build fails; `astro check` pre-commit; phase-2 admin warns. |
| Sensitive data leak via bundle | H | Build-time strip in `Base.astro`; e2e bundle keyword scan. |
| Theme switcher FOUC | L | Inline `is:inline` script before CSS. |
| EN content missing | L | Field optional + UI hides empty EN; never duplicates VI. |

---

## 12. Acceptance Criteria (phase 1 done)

- [ ] All 9 pages build pass `astro check` (zero ts/schema errors)
- [ ] Lighthouse ≥ 95 on Performance / Accessibility / Best-Practices / SEO for every page
- [ ] Family tree pan/zoom works on Chrome desktop + iOS Safari mobile
- [ ] Modal opens from ≥3 entry points (member card, tree node, related from timeline/photo)
- [ ] Theme switcher persists across reload, no FOUC
- [ ] Bilingual labels render correctly across all UI
- [ ] Local Docker container serves all 9 routes 200 OK
- [ ] `DEPLOY.md` step-by-step verified on Coolify
- [ ] `PHASE-2-ADMIN.md` documents Decap/Sveltia migration path
