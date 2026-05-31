import { safeFetch, type FetchError } from "~/utils/safe-fetch";
import { Result } from "better-result";
import { z } from "zod";
import { ACCESS_TOKEN_URL } from "~/constants";

const TIMEOUT_MS = 5_000;
/** Refresh this far before the real expiry to avoid using a token mid-flight. */
const REFRESH_MARGIN_MS = 60_000;
const KV_KEY = "reddit:app-token";

const TokenResponseSchema = z.object({
  access_token: z.string(),
  expires_in: z.number(),
  token_type: z.string(),
});

interface CachedToken {
  expiresAt: number;
  token: string;
}

/**
 * Per-isolate token cache, fronting the KV cache so warm isolates skip both the
 * network and KV. Module-level so it persists across requests in one isolate.
 */
let cached: CachedToken | undefined;

function isFresh(entry: CachedToken, now: number): boolean {
  return entry.expiresAt - REFRESH_MARGIN_MS > now;
}

/**
 * Returns an app-only (`client_credentials`) Reddit access token, reusing a
 * cached one when fresh. Lookup order: in-isolate var → `TOKENS` KV → mint a
 * new one. A freshly minted token is written back to both caches.
 *
 * @param env Worker bindings (`REDDIT_CLIENT_ID`/`_SECRET`, `REDDIT_USER_AGENT`, `TOKENS`).
 * @param options.force Skip the caches and mint a fresh token (used to retry after a 401).
 *
 * @returns A `Result` with the bearer token, or a {@link FetchError} if minting failed.
 */
export async function getAccessToken(
  env: Env,
  options?: { force?: boolean },
): Promise<Result<string, FetchError>> {
  const now = Date.now();

  if (!options?.force) {
    if (cached && isFresh(cached, now)) return Result.ok(cached.token);

    const stored = await readKv(env, now);
    if (stored) {
      cached = stored;
      return Result.ok(stored.token);
    }
  }

  const minted = await mintToken(env, now);
  if (minted.isErr()) return Result.err(minted.error);

  cached = minted.value;
  await writeKv(env, minted.value);
  return Result.ok(minted.value.token);
}

async function mintToken(env: Env, now: number): Promise<Result<CachedToken, FetchError>> {
  const credentials = btoa(`${env.REDDIT_CLIENT_ID}:${env.REDDIT_CLIENT_SECRET}`);

  const result = await safeFetch(ACCESS_TOKEN_URL, {
    body: "grant_type=client_credentials",
    headers: {
      authorization: `Basic ${credentials}`,
      "content-type": "application/x-www-form-urlencoded",
      "user-agent": env.REDDIT_USER_AGENT,
    },
    method: "POST",
    schema: TokenResponseSchema,
    timeout: TIMEOUT_MS,
  });

  if (result.isErr()) return Result.err(result.error);

  return Result.ok({
    expiresAt: now + result.value.expires_in * 1_000,
    token: result.value.access_token,
  });
}

/**
 * Reads a fresh token from KV, or `null` on miss/expiry/error (cache is best-effort)
 *
 * @param env Worker bindings (reads the `TOKENS` KV namespace).
 * @param now Current epoch ms, used to check freshness.
 *
 * @returns The cached token if present and still fresh, otherwise `null`.
 */
async function readKv(env: Env, now: number): Promise<CachedToken | null> {
  try {
    const stored = await env.TOKENS.get<CachedToken>(KV_KEY, "json");
    return stored && isFresh(stored, now) ? stored : null;
  } catch {
    return null;
  }
}

/**
 * Persists a token to KV, expiring it with the token. Failures are non-fatal
 *
 * @param env Worker bindings (writes the `TOKENS` KV namespace).
 * @param entry The token and its expiry to store.
 */
async function writeKv(env: Env, entry: CachedToken): Promise<void> {
  const ttlSeconds = Math.max(60, Math.floor((entry.expiresAt - Date.now()) / 1_000));
  try {
    await env.TOKENS.put(KV_KEY, JSON.stringify(entry), {
      expirationTtl: ttlSeconds,
    });
  } catch {
    // KV is a best-effort cache - a write failure just means a re-mint later.
  }
}
