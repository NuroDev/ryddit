import { safeFetch, type FetchError } from "~/utils/safe-fetch";
import { Result, TaggedError } from "better-result";
import { OAUTH_BASE } from "~/constants";
import { getAccessToken } from "~/reddit/auth";
import { RedditPostResponseSchema, type RedditPostResponse } from "~/reddit/schema";

const TIMEOUT_MS = 3_000;

/**
 * A `/r/:sub/s/:id` share link did not redirect to a resolvable permalink.
 */
export class ShareLinkError extends TaggedError("ShareLinkError")<{
  message: string;
  url: string;
}>() {
  constructor(args: { url: string }) {
    super({
      message: `Could not resolve share link ${args.url}`,
      url: args.url,
    });
  }
}

function authHeaders(env: Env, token: string): Record<string, string> {
  return {
    accept: "application/json",
    authorization: `Bearer ${token}`,
    "user-agent": env.REDDIT_USER_AGENT,
  };
}

/**
 * Runs an authenticated request, retrying once with a fresh token on a 401
 * (the cached token may have expired or been revoked).
 *
 * @param env Worker bindings.
 * @param run Performs the request with the given bearer token.
 *
 * @returns The request's `Result`, or the token-mint error if auth failed.
 */
async function withAuth<T>(
  env: Env,
  run: (token: string) => Promise<Result<T, FetchError>>,
): Promise<Result<T, FetchError>> {
  const token = await getAccessToken(env);
  if (token.isErr()) return Result.err(token.error);

  const result = await run(token.value);
  if (!result.isErr() || result.error._tag !== "HttpError" || result.error.status !== 401) {
    return result;
  }

  const refreshed = await getAccessToken(env, { force: true });
  if (refreshed.isErr()) return Result.err(refreshed.error);
  return run(refreshed.value);
}

/**
 * Fetches and validates a Reddit post-page listing from `path` against the
 * authenticated API host. This is the single Reddit-transport boundary.
 *
 * @param env Worker bindings.
 * @param path Reddit path beginning with `/` (without the `?raw_json=1` query).
 *
 * @returns A `Result` with the validated `[postListing, commentListing]`
 *   response, or a {@link FetchError} (auth/network/timeout/HTTP/parse/validation).
 */
function fetchListing(env: Env, path: string): Promise<Result<RedditPostResponse, FetchError>> {
  const url = new URL(path, OAUTH_BASE);
  url.searchParams.set("raw_json", "1");
  return withAuth(env, (token) =>
    safeFetch(url, {
      headers: authHeaders(env, token),
      schema: RedditPostResponseSchema,
      timeout: TIMEOUT_MS,
    }),
  );
}

/**
 * Fetches a post by its base-36 id via the `/comments/:id` permalink.
 *
 * @param env Worker bindings.
 * @param id36 The post's base-36 id (e.g. `abc123`).
 *
 * @returns A `Result` with the post listing, or a {@link FetchError}.
 */
export function fetchPostById(
  env: Env,
  id36: string,
): Promise<Result<RedditPostResponse, FetchError>> {
  return fetchListing(env, `/comments/${id36}.json`);
}

/**
 * Fetches a post by its subreddit + base-36 id.
 *
 * @param env Worker bindings.
 * @param subreddit The subreddit name (without the `r/` prefix).
 * @param id36 The post's base-36 id.
 *
 * @returns A `Result` with the post listing, or a {@link FetchError}.
 */
export function fetchPostByPermalink(
  env: Env,
  subreddit: string,
  id36: string,
): Promise<Result<RedditPostResponse, FetchError>> {
  return fetchListing(env, `/r/${subreddit}/comments/${id36}.json`);
}

/**
 * Resolves a `/r/:sub/s/:id` share link to its canonical permalink by
 * following the redirect manually and reading the `Location` header.
 *
 * @param env Worker bindings.
 * @param subreddit The subreddit name (without the `r/` prefix).
 * @param shareId The opaque share id from the `/s/` URL.
 *
 * @returns A `Result` with the resolved permalink URL, a {@link FetchError},
 *   or a {@link ShareLinkError} when no `Location` was returned.
 */
export async function resolveShareLink(
  env: Env,
  subreddit: string,
  shareId: string,
): Promise<Result<string, FetchError | ShareLinkError>> {
  const url = new URL(`/r/${subreddit}/s/${shareId}`, OAUTH_BASE);

  const result = await withAuth(env, (token) =>
    safeFetch(url, {
      acceptStatus: (status) => status >= 200 && status < 400,
      headers: authHeaders(env, token),
      redirect: "manual",
      timeout: TIMEOUT_MS,
    }),
  );

  if (result.isErr()) return Result.err(result.error);

  const location = result.value.headers.get("location");
  if (!location) return Result.err(new ShareLinkError({ url: url.href }));

  return Result.ok(location);
}
