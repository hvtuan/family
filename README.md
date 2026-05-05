# Family

Multi-generation Vietnamese family showcase — built with Astro, Tailwind v4, and React islands.

Bilingual (Vietnamese + English), 9 pages including an interactive family tree with pan/zoom, member detail modals with photo slideshows, timeline, photo album, traditions, sayings, hometown map, and calendar of memorials & birthdays.

## Stack

- [Astro 6](https://astro.build) (static output)
- TypeScript (strict)
- [Tailwind CSS v4](https://tailwindcss.com) (CSS-first `@theme` config)
- [React 19](https://react.dev) (islands only — Family Tree, Modal, Theme Switcher, Filter)
- [Radix UI](https://www.radix-ui.com) (Dialog, Tabs)
- [Embla Carousel](https://www.embla-carousel.com) (photo slideshow)
- [Nanostores](https://github.com/nanostores/nanostores) (cross-island state)
- Astro Content Collections (markdown + Zod) — see `src/content.config.ts`

## Commands

```bash
pnpm install            # install deps
pnpm dev                # dev server at http://localhost:4321
pnpm build              # type-check + production build → dist/
pnpm preview            # preview built site
pnpm check              # run astro check only
pnpm check:privacy      # scan dist/ for leaked private contact fields
```

## Project structure

See `DESIGN.md` for full architecture.

```
src/
├── content.config.ts        # Zod schemas for 7 collections
├── content/                 # 7 collections (members, timeline, traditions, photos, quotes, dates, locations)
├── components/
│   ├── astro/               # Static UI primitives (no JS)
│   └── react/               # Hydrated islands
│       ├── ThemeSwitcher.tsx
│       ├── MemberModal.tsx       # Radix Dialog + Tabs singleton
│       ├── MemberFilter.tsx      # /members search + filters
│       └── FamilyTree.tsx        # /family-tree pan/zoom SVG
├── layouts/Base.astro       # html shell, theme bootstrap, nav, footer, modal mount
├── pages/                   # 9 routes + 404
├── lib/                     # utils + members-client (sensitive-field strip)
├── stores/ui.ts             # nanostores ($modalMember, $theme)
└── styles/global.css        # @theme tokens + variants

scripts/
└── check-bundle-privacy.mjs # post-build scan for leaked contact fields

Dockerfile, nginx.conf       # multi-stage container for Coolify
.github/workflows/ci.yml     # build + privacy scan + Coolify deploy webhook
```

## Editing content

Each member, tradition, event, photo, quote, date, and location lives as its own file under `src/content/{collection}/`. Edit the frontmatter or body markdown directly; the build will re-validate against the Zod schema in `src/content.config.ts`.

## Privacy

Members with `contactPublic: false` (default) have their `phone`, `email`, `address`, and `social.*` fields stripped before being serialised into client bundles. `pnpm check:privacy` runs after every build (also in CI) and fails if any private value ends up in `dist/`. Members with `contactPublic: true` opt in to having their contact info visible in the modal "Liên lạc" tab.

## Themes

Three visual themes ship out of the box (Classic / Scroll / Modern Heritage). Switch via the toggle in the top nav; choice persists in localStorage.

## Deploy

See [`DEPLOY.md`](./DEPLOY.md) for Coolify + Cloudflare Tunnel deployment. See [`PHASE-2-ADMIN.md`](./PHASE-2-ADMIN.md) for adding an admin UI later.

## License

Private family project.
