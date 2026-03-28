# Mona Mayhem — Project Guidelines

Retro arcade-themed Astro app for comparing two GitHub users' contribution graphs. See [README.md](../README.md) for workshop context and [workshop/01-setup.md](../workshop/01-setup.md) for the guided setup flow.

## Build And Dev

- `npm install` installs dependencies.
- `npm run dev` starts the Astro dev server on `http://localhost:4321`.
- `npm run build` builds the SSR app.
- `npm run preview` previews the production build locally.
- There is currently no automated test script in `package.json`; validate features with focused manual checks and build the app before finishing larger changes.

## Architecture

- `src/pages/index.astro` is the main page and should stay the primary battle UI entry point.
- `src/pages/api/contributions/[username].ts` is the server-side API proxy for contribution data.
- `public/` holds static assets for the Astro app.
- `docs/` is a separate static workshop site deployed by GitHub Pages; it is not the Astro runtime app.

The Astro app runs in full SSR mode using the Node adapter with `output: 'server'`. Do not convert API routes or the main app flow to static-only behavior unless the task explicitly requires it.

## Conventions

- Keep `.astro` frontmatter focused on page-level server logic. Move reusable parsing, data shaping, or validation logic into helper modules when it stops being trivial.
- API routes belong under `src/pages/api/`, should export typed `APIRoute` handlers, and should keep `export const prerender = false` when they depend on live upstream data.
- TypeScript uses Astro strict mode. Prefer `import type` for type-only imports and avoid weakening types to `any` without a clear reason.
- Prefer scoped `<style>` blocks in `.astro` files unless styling is intentionally shared.
- This repo does not use React, Vue, or Svelte. Do not add a client framework unless the feature genuinely requires it.

## Project Notes

- The contribution endpoint uses `https://github.com/{username}.contribs`; handle upstream failures, invalid usernames, and rate limiting with explicit HTTP status codes.
- Keep the retro arcade visual language intact. The project theme uses the Press Start 2P font and intentionally playful, pixel-style UI choices.
- `workshop/` content is instructional material. Do not modify it during normal feature work unless the task is specifically about the workshop docs.
- If a change affects the workshop site in `docs/`, remember that `.github/workflows/deploy.yml` publishes `docs/` to GitHub Pages rather than the Astro SSR app.
