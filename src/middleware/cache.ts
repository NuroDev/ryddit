import { cache } from "hono/cache";
import { isCrawler } from "~/utils/crawler";

/**
 * Edge-caches crawler embeds. The cache key is partitioned by crawler-vs-browser
 * so a cached crawler embed is never served to a browser (or vice versa); only
 * the crawler's 200 HTML is cacheable (browser redirects are 302s, which the
 * middleware skips). Applied only to the post routes.
 */
export const cachePost = cache({
  cacheControl: "public, max-age=86400",
  cacheName: "ryddit",
  keyGenerator: (c) => `${c.req.url}|${isCrawler(c.req.header("user-agent")) ? "bot" : "human"}`,
});
