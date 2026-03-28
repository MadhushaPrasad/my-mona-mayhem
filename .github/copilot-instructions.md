# Mona Mayhem — GitHub Contribution Battle Arena

A retro arcade-themed Astro app that compares two GitHub users' contribution graphs. Built as a workshop project for VS Code + GitHub Copilot.

## Build & Dev Commands

```bash
npm install        # install dependencies
npm run dev        # start dev server (http://localhost:4321)
npm run build      # production build
npm run preview    # preview production build locally
```

## Architecture

- `src/pages/index.astro` — main page, entry point for the battle UI
- `src/pages/api/contributions/[username].ts` — SSR API route; fetches GitHub contribution data for a given username
- `public/` — static assets (favicon, images)

The site runs in **full SSR mode** (`output: 'server'`) using the `@astrojs/node` adapter in standalone mode. There is no static pre-rendering by default; all pages and API routes are server-rendered.

## Astro Conventions

- **`.astro` files**: Use the frontmatter fence (`---`) for server-side logic. Keep component script minimal; move complex logic to helper modules in `src/lib/` or `src/utils/`.
- **API routes**: Place under `src/pages/api/`. Export named HTTP method handlers (`GET`, `POST`, etc.) typed as `APIRoute`. Set `export const prerender = false` when the route must remain dynamic.
- **Styles**: Prefer scoped `<style>` blocks inside `.astro` files. Use global styles only in `src/layouts/` or imported via `<style is:global>`.
- **TypeScript**: All `.ts` files use strict mode (see `tsconfig.json`). Prefer `import type` for type-only imports.
- **No framework components by default** — this project does not use React/Vue/Svelte integrations. Add only if the feature genuinely needs client-side interactivity.

## Key Notes

- The GitHub contribution graph is fetched from `https://github.com/{username}.contribs` (HTML scrape) — handle rate limits and failed fetches gracefully with proper HTTP status codes.
- The retro aesthetic uses the **Press Start 2P** Google Font. Keep new UI consistent with the pixel/arcade theme.
- `workshop/` files are docs only — do not modify them during feature development.
