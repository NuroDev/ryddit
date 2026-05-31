import { CRAWLER_PATTERNS } from "~/constants";

/**
 * Detects link-preview crawlers by User-Agent. Crawlers are served embed HTML;
 * everything else (real browsers) is redirected to the original Reddit URL.
 *
 * @param userAgent The request's `User-Agent` header, if any.
 *
 * @returns `true` when the User-Agent looks like a link-preview crawler.
 */
export function isCrawler(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false;
  const ua = userAgent.toLowerCase();
  return CRAWLER_PATTERNS.some((pattern) => ua.includes(pattern));
}
