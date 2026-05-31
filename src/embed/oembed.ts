import { REDDIT_BASE } from "~/constants";
import type { Post } from "~/reddit/parse";

/**
 * oEmbed 1.0 response (the `link` type - we only carry byline metadata)
 */
export interface OEmbed {
  author_name: string;
  author_url: string;
  provider_name: string;
  provider_url: string;
  type: "link";
  version: "1.0";
}

/**
 * Query params carried on the oEmbed discovery URL embedded in the HTML
 */
export interface OEmbedParams {
  author?: string;
  authorUrl?: string;
  provider?: string;
}

/**
 * Builds the oEmbed discovery URL for a post.
 *
 * The byline data is carried as query params so the `/oembed` endpoint is stateless (no refetch needed).
 *
 * @param origin The request's own origin (e.g. `https://ryddit.example.com`).
 * @param post The post whose byline (`u/author`, `r/subreddit`) is encoded.
 *
 * @returns The absolute oEmbed discovery URL.
 */
export function buildOEmbedHref(origin: string, post: Post): string {
  const params = new URLSearchParams({
    author: `u/${post.author}`,
    authorUrl: new URL(`/u/${post.author}`, REDDIT_BASE).href,
    provider: `r/${post.subreddit}`,
  });
  return `${origin}/oembed?${params.toString()}`;
}

/**
 * Builds the oEmbed JSON body from the discovery URL's query params.
 *
 * @param params The byline params read from the discovery URL's query string.
 *
 * @returns The oEmbed 1.0 response body.
 */
export function renderOEmbed(params: OEmbedParams): OEmbed {
  return {
    author_name: params.author ?? "",
    author_url: params.authorUrl ?? REDDIT_BASE,
    provider_name: params.provider ?? "ryddit",
    provider_url: REDDIT_BASE,
    type: "link",
    version: "1.0",
  };
}
