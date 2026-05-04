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
- Astro Content Collections (markdown + Zod) — see `src/content/config.ts`

## Commands

```bash
pnpm install          # install deps
pnpm dev              # dev server at http://localhost:4321
pnpm build            # type-check + production build → dist/
pnpm preview          # preview built site
pnpm check            # run astro check only
```

## Project structure

See `DESIGN.md` for full architecture.

```
src/
├── content/      # 7 collections of markdown/data files (members, timeline, …)
├── components/
│   ├── astro/    # Static UI primitives (no JS)
│   └── react/    # Hydrated islands (FamilyTree, MemberModal, ThemeSwitcher, MemberFilter)
├── layouts/      # Base.astro
├── pages/        # 9 routes
├── lib/          # utils
├── stores/       # nanostores
└── styles/       # global.css with @theme tokens + variants
```

## Editing content

Each member, tradition, event, photo, quote, date, and location lives as its own file under `src/content/{collection}/`. Edit the frontmatter or body markdown directly; the build will re-validate against the Zod schema in `src/content/config.ts`.

## Themes

Three visual themes ship out of the box (Classic / Scroll / Modern Heritage). Switch via the toggle in the top nav; choice persists in localStorage.

## Deploy

See [`DEPLOY.md`](./DEPLOY.md) for Coolify + Cloudflare Tunnel deployment. See [`PHASE-2-ADMIN.md`](./PHASE-2-ADMIN.md) for adding an admin UI later.

## License

Private family project.
