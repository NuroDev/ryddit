# ryddit

Rich link previews for Reddit. Share a Reddit link on Discord, Telegram, Slack,
or anywhere else that unfurls links, and get a proper embed - title, author,
image, gallery, or inline video - instead of Reddit's bare preview.

It's the Reddit equivalent of [fxtwitter](https://github.com/FixTweet/FixTweet)
/ fxreddit, running on Cloudflare Workers.

## Usage

Swap `reddit.com` for `ryddit.com` in any post link:

```
https://www.reddit.com/r/memes/comments/abc123/some_post/
→ https://ryddit.com/r/memes/comments/abc123/some_post/
```

Paste that into a chat app and it unfurls with a rich embed. Open it in a
browser and you're redirected straight to the original Reddit post - the embed
is only served to link-preview crawlers.

## How it works

```
request
   │
   ├─ link-preview crawler (Discordbot, Telegrambot, …)?
   │     └─ fetch the post from Reddit → render OpenGraph/Twitter-Card HTML
   │
   └─ real browser?
         └─ 302 redirect to the original Reddit URL (no API call)
```

- **Crawler detection** is by `User-Agent`. Crawlers get HTML full of
  OpenGraph/Twitter meta tags (plus an [oEmbed](https://oembed.com/) endpoint for
  the author/provider byline); everyone else is redirected, so humans never cost
  an API call.
- **Authenticated Reddit access.** Reddit now `403`-blocks unauthenticated
  `.json` scraping, so ryddit reads via **app-only OAuth** (`client_credentials`)
  against `oauth.reddit.com`. The access token is cached (in-memory + a KV
  namespace) and auto-refreshed.
- **Media.** Handles text, images, galleries, and native `v.redd.it` video
  (served via a `/v/` proxy that redirects to Reddit's MP4). NSFW posts are
  rendered without leaking a thumbnail.
- **Caching.** Crawler embeds are edge-cached (Cloudflare Cache API), keyed so a
  crawler embed is never served to a browser and vice versa.

## Self-hosting

You'll need a Cloudflare account and a Reddit app.

1. **Register a Reddit app** at [developers.reddit.com](https://developers.reddit.com)
   (a confidential "web"/"script" app) to get a client ID and secret.
2. **Set the secrets:**
   ```sh
   wrangler secret put REDDIT_CLIENT_ID
   wrangler secret put REDDIT_CLIENT_SECRET
   ```
   For local dev, copy `.example.env` → `.env` and fill them in.
3. **Create the token-cache KV namespace** and paste its id into `wrangler.jsonc`:
   ```sh
   wrangler kv namespace create TOKENS
   ```
4. **Edit `wrangler.jsonc`** - set `REDDIT_USER_AGENT` (Reddit requires a unique,
   descriptive UA) and the `route` to your own domain.
5. **Deploy:**
   ```sh
   pnpm deploy
   ```

## Development

```sh
pnpm install
pnpm dev          # local server (wrangler dev)
pnpm test         # vitest
pnpm typecheck    # tsc
pnpm check        # oxfmt + oxlint
```

To preview an embed locally, request it as a crawler (a normal browser request
just redirects):

```sh
curl -sA 'Discordbot/2.0' http://localhost:8787/r/memes/comments/abc123/some_post
```

## Built with

[Hono](https://hono.dev) on Cloudflare Workers, [Zod](https://zod.dev),
[better-result](https://www.npmjs.com/package/better-result), Hono JSX, and
[Vitest](https://vitest.dev) with [MSW](https://mswjs.io).

## Credits

The original project idea and structure come from
[**fxreddit** by MinnDevelopment](https://github.com/MinnDevelopment/fxreddit).
ryddit is an independent reimplementation; all credit for the concept goes there.

## License

[MIT](./LICENSE)
