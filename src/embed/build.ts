import { matchErrorPartial, type Result } from "better-result";
import type { Context } from "hono";
import { renderError, renderPost } from "~/embed/render";
import type { ShareLinkError } from "~/reddit/client";
import { parsePost } from "~/reddit/parse";
import type { RedditPostResponse } from "~/reddit/schema";
import type { FetchError } from "~/utils/safe-fetch";

/**
 * Builds the crawler embed response: fetches the post, renders its
 * OpenGraph/Twitter-Card HTML, or returns a minimal fallback embed on failure
 * so a crawler always gets something. The `cachePost` middleware sets
 * `Cache-Control` and caches the 200.
 *
 * @param c The request context.
 * @param redditUrl The canonical Reddit URL, used for the fallback embed's link.
 * @param fetcher Fetches (and on the share path, resolves then fetches) the post listing.
 *
 * @returns The embed HTML response - 200 on success, 404/502 on failure.
 */
export async function buildEmbed(
  c: Context,
  redditUrl: URL,
  fetcher: () => Promise<Result<RedditPostResponse, FetchError | ShareLinkError>>,
): Promise<Response> {
  const result = await fetcher();
  if (result.isErr()) {
    const status = matchErrorPartial(
      result.error,
      { HttpError: (e): 404 | 502 => (e.status === 404 ? 404 : 502) },
      (): 404 | 502 => 502,
    );
    console.warn(`Reddit fetch failed (${status}): ${result.error.message}`);
    return c.html(renderError(redditUrl.href), status, {
      "cache-control": "no-store",
    });
  }

  const post = parsePost(result.value);
  if (!post) {
    console.info(`No renderable post for ${redditUrl}`);
    return c.html(renderError(redditUrl.href), 404, {
      "cache-control": "no-store",
    });
  }

  const origin = new URL(c.req.url).origin;

  // `cachePost` middleware sets `Cache-Control` and caches the 200 embed.
  return c.html(renderPost(post, origin), 200);
}
