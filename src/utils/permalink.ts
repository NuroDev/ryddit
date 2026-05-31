import { PERMALINK_PATTERN } from "~/constants";

/**
 * Extracts `{ subreddit, id }` from a Reddit comments permalink (a full URL or
 * a bare path). Used to resolve a `/s/` share-link redirect into the post it
 * points at.
 *
 * @param url A Reddit URL or path containing a `/r/:sub/comments/:id` segment.
 *
 * @returns The parsed `{ subreddit, id }`, or `null` when the URL doesn't match.
 */
export function parsePermalink(url: string): { id: string; subreddit: string } | null {
  const match = url.match(PERMALINK_PATTERN);
  if (!match?.[1] || !match[2]) return null;
  return {
    id: match[2],
    subreddit: match[1],
  };
}
