# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

ryddit serves rich link previews for Reddit posts (the fxreddit/fxtwitter pattern), running as a single Cloudflare Worker. It is Hono + Hono JSX, written in TypeScript, deployed via Wrangler.

## Commands

```sh
pnpm dev          # wrangler dev (local worker at http://localhost:8787)
pnpm test         # vitest run (Workers pool via @cloudflare/vitest-pool-workers)
pnpm test:watch   # vitest watch
pnpm typecheck    # tsc --noEmit over src AND __tests__ (two tsconfigs)
pnpm check        # oxfmt --check && oxlint (read-only gate)
pnpm lint         # oxlint --fix
pnpm format       # oxfmt (writes)
pnpm cf-typegen   # regenerate worker-configuration.d.ts (the `Env` type) from wrangler.jsonc
pnpm deploy       # wrangler deploy
```

Run a single test file: `pnpm vitest run __tests__/parse.test.ts`. Filter by name: `pnpm vitest run -t "redirects the root"`.

Before claiming work is done, run `pnpm typecheck && pnpm check && pnpm test`. After changing bindings/vars in `wrangler.jsonc`, run `pnpm cf-typegen` so `Env` stays accurate.

To preview an embed locally you must send a crawler User-Agent (a browser UA just 302-redirects):

```sh
curl -sA 'Discordbot/2.0' http://localhost:8787/r/memes/comments/abc123/some_post
```

## Core request flow

Every post route runs the same pipeline (`src/routes/*.ts`):

1. `cachePost` middleware (`src/middleware/cache.ts`) checks the edge cache. The cache key is partitioned by crawler-vs-browser (`${url}|bot|human`) so a crawler embed is never served to a browser.
2. `isCrawler(user-agent)` (`src/utils/crawler.ts`, matched against `CRAWLER_PATTERNS`) decides the branch:
   - **Browser** → `302` redirect to the real `reddit.com` URL. No Reddit API call, so human traffic costs nothing.
   - **Crawler** → `buildEmbed(...)` fetches the post and renders OpenGraph/Twitter-Card HTML.
3. `buildEmbed` (`src/embed/build.ts`) calls the fetcher → `parsePost` → `renderPost`. On any failure it returns a minimal fallback embed (`renderError`) with `cache-control: no-store`, so a crawler always gets _something_. Only the successful 200 is edge-cached.

`/v/...` video routes (`src/routes/videos.ts`) are the exception: they fetch the post and `302` to Reddit's MP4 `fallbackUrl` for everyone (used by the embed's `<video>` tag), with no crawler check.

## Architecture boundaries

- **`src/router.ts`** mounts everything on one Hono app. **Route order matters**: specific routes (`/comments/:id`, `/r/:sub/...`, `/v/...`) are registered before the `/:id` catch-all in `src/routes/id.ts`. Add new specific routes before `idRoute`.
- **`src/reddit/`** is the only code that talks to Reddit. `client.ts` is the single transport boundary (`fetchPostById`, `fetchPostByPermalink`, `resolveShareLink`). `auth.ts` mints/caches the app-only OAuth token. `schema.ts` is the Zod schema for Reddit's response; `parse.ts` normalizes it into the source-agnostic `Post` model.
- **`src/embed/`** is the only code that produces output for crawlers: `render.tsx` (Hono JSX → meta-tag HTML), `oembed.ts` (byline JSON), `build.ts` (orchestration).
- The `Post` interface in `src/reddit/parse.ts` is the contract between the Reddit layer and the embed layer. Render code should depend on `Post`, never on raw Reddit JSON.

## Reddit auth & token caching

Reddit `403`s unauthenticated `.json` scraping, so all reads go to `oauth.reddit.com` with a bearer token from the `client_credentials` grant. `getAccessToken` (`src/reddit/auth.ts`) has a three-tier cache: in-isolate module var → `TOKENS` KV namespace → mint new. `client.ts`'s `withAuth` retries once with a force-refreshed token on a `401`. KV writes/reads are best-effort (failures are swallowed).

## Conventions specific to this repo

- **Error handling is Result-based, not exceptions.** `safeFetch` (`src/utils/safe-fetch/`) wraps `fetch` so every failure mode surfaces as a tagged error (`HttpError`, `NetworkError`, `TimeoutError`, `AbortError`, `ParseError`, `ValidationError`) inside a `better-result` `Result`. The error union is derived from the option shape (e.g. `ValidationError` only appears when you pass `schema`). Use `result.isErr()` / `matchErrorPartial` to branch. Don't add `try/catch` around these calls.
- **Validate at the transport edge.** Pass a Zod `schema` to `safeFetch`; downstream code receives validated data.
- **`origin` is always derived from the request** (`new URL(c.req.url).origin`), never hardcoded, so the worker runs on any domain. Pass it through to `renderPost`/oEmbed builders.
- **NSFW posts never leak a thumbnail** (`parsePost` strips the image and renders as text/link). Preserve this when touching `parse.ts`.
- Import alias `~/*` → `src/*` (configured in both `tsconfig.json` and `vitest.config.ts`); tests also have `@/*` → `__tests__/*`.
- JSX is Hono JSX (`jsxImportSource: "hono/jsx"`), not React. `.tsx` files render to HTML strings, not a DOM.

## Testing

Tests run inside the Workers runtime via `@cloudflare/vitest-pool-workers` (config in `vitest.config.ts`), using `cloudflare:test`'s `env` and `createExecutionContext`. Reddit's API is mocked with **MSW** (`__tests__/mocks/server.ts`, set up in `__tests__/setup.ts`); per-test handlers via `server.use(http.get(...))`. Test secrets are injected in `vitest.config.ts`'s miniflare `bindings`. Tests live in `__tests__/*.test.ts` and have their own `__tests__/tsconfig.json` (hence the two-project `typecheck`).
