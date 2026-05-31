/** App-only OAuth token endpoint (`client_credentials` grant). */
export const ACCESS_TOKEN_URL = "https://www.reddit.com/api/v1/access_token" satisfies string;

/**
 * User-Agent substrings used by link-preview crawlers. `bot` alone catches
 * Discordbot / Twitterbot / TelegramBot / Slackbot / LinkedInBot etc.; the
 * rest cover crawlers that don't include "bot".
 */
export const CRAWLER_PATTERNS = [
  "bot",
  "embedly",
  "facebookexternalhit",
  "iframely",
  "redditbot",
  "skypeuripreview",
  "slack",
  "steamchaturllookup",
  "telegram",
  "vkshare",
  "whatsapp",
] satisfies Array<string>;

export const IMAGE_EXTENSION = /\.(?:gif|jpe?g|png|webp)$/i;

/** Authenticated API host - all post/comment reads go here with a bearer token. */
export const OAUTH_BASE = "https://oauth.reddit.com" satisfies string;

export const PERMALINK_PATTERN = /\/r\/([^/]+)\/comments\/([a-z0-9]+)/i;

/** Public site host - canonical post URLs and the `/api/v1/access_token` endpoint. */
export const REDDIT_BASE = "https://www.reddit.com" satisfies string;

export const REPO_URL = "https://github.com/nurodev/ryddit";

export const THEME_COLOR = "#FF4500" satisfies `#${string}`;
