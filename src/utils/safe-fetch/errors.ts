import { TaggedError } from "better-result";

/**
 * Body reader exposed by {@link Response}. Used by `safeFetch`'s `as` option
 * and by {@link ParseError} to record which reader threw.
 */
export type BodyFormat = "arrayBuffer" | "blob" | "formData" | "json" | "text";

/**
 * The underlying `fetch` call rejected before a response was received - DNS
 * failure, connection refused, TLS error, or any other transport-level
 * problem.
 *
 * @example
 * ```ts
 * const err = new NetworkError({
 *     cause: new TypeError('fetch failed'),
 *     url: 'https://api.example.com',
 * });
 * ```
 */
export class NetworkError extends TaggedError("NetworkError")<{
  cause: unknown;
  message: string;
  url: string;
}>() {
  /**
   * @param args.cause - The error thrown by `fetch` (typically a `TypeError`).
   * @param args.url   - The request URL.
   */
  constructor(args: { cause: unknown; url: string }) {
    const causeMessage = args.cause instanceof Error ? args.cause.message : String(args.cause);
    super({
      cause: args.cause,
      message: `Network request to ${args.url} failed: ${causeMessage}`,
      url: args.url,
    });
  }
}

/**
 * The request was aborted because the `timeout` option elapsed before a
 * response arrived. Distinct from {@link AbortError}, which fires when the
 * caller's own `signal` aborts.
 *
 * @example
 * ```ts
 * const err = new TimeoutError({ timeoutMs: 5_000, url: 'https://x.example' });
 * ```
 */
export class TimeoutError extends TaggedError("TimeoutError")<{
  message: string;
  timeoutMs: number;
  url: string;
}>() {
  /**
   * @param args.timeoutMs - The configured timeout in milliseconds.
   * @param args.url       - The request URL.
   */
  constructor(args: { timeoutMs: number; url: string }) {
    super({
      message: `Request to ${args.url} timed out after ${args.timeoutMs}ms`,
      timeoutMs: args.timeoutMs,
      url: args.url,
    });
  }
}

/**
 * The request was aborted via the caller-provided {@link AbortSignal}.
 * Distinct from {@link TimeoutError}, which fires when `safeFetch`'s own
 * `timeout` elapses.
 *
 * @example
 * ```ts
 * const err = new AbortError({ url: 'https://x.example' });
 * ```
 */
export class AbortError extends TaggedError("AbortError")<{
  message: string;
  url: string;
}>() {
  /**
   * @param args.url - The request URL.
   */
  constructor(args: { url: string }) {
    super({
      message: `Request to ${args.url} was aborted`,
      url: args.url,
    });
  }
}

/**
 * The server returned a response whose status was rejected by `acceptStatus`
 * (default: anything outside 200–299). The original {@link Response} is
 * attached so consumers can read the body, headers, etc.
 *
 * @example
 * ```ts
 * const err = new HttpError({
 *     response: new Response('nope', { status: 404, statusText: 'Not Found' }),
 *     url: 'https://api.example.com/users/42',
 * });
 * console.log(err.status);          // 404
 * console.log(await err.response.text()); // 'nope'
 * ```
 */
export class HttpError extends TaggedError("HttpError")<{
  message: string;
  response: Response;
  status: number;
  statusText: string;
  url: string;
}>() {
  /**
   * @param args.response - The original {@link Response} (body unconsumed).
   * @param args.url      - The request URL.
   */
  constructor(args: { response: Response; url: string }) {
    super({
      message: `HTTP ${args.response.status} ${args.response.statusText} from ${args.url}`,
      response: args.response,
      status: args.response.status,
      statusText: args.response.statusText,
      url: args.url,
    });
  }
}

/**
 * The body reader (`response.json()`, `response.text()`, etc.) threw - most
 * commonly a malformed JSON payload.
 *
 * @example
 * ```ts
 * const err = new ParseError({
 *     as: 'json',
 *     cause: new SyntaxError('Unexpected token'),
 *     url: 'https://api.example.com/users',
 * });
 * ```
 */
export class ParseError extends TaggedError("ParseError")<{
  as: BodyFormat;
  cause: unknown;
  message: string;
  url: string;
}>() {
  /**
   * @param args.as    - Which body reader was invoked.
   * @param args.cause - The error thrown by the body reader.
   * @param args.url   - The request URL.
   */
  constructor(args: { as: BodyFormat; cause: unknown; url: string }) {
    const causeMessage = args.cause instanceof Error ? args.cause.message : String(args.cause);
    super({
      as: args.as,
      cause: args.cause,
      message: `Failed to parse ${args.url} as ${args.as}: ${causeMessage}`,
      url: args.url,
    });
  }
}

/**
 * The parsed body was rejected by the `schema` validator passed to
 * `safeFetch`. The original validator error is preserved on `cause`.
 *
 * @example
 * ```ts
 * import { z } from 'zod';
 *
 * const User = z.object({ id: z.string() });
 * try {
 *     User.parse({ id: 1 });
 * } catch (cause) {
 *     const err = new ValidationError({ cause, url: 'https://x.example' });
 * }
 * ```
 */
export class ValidationError extends TaggedError("ValidationError")<{
  cause: unknown;
  message: string;
  url: string;
}>() {
  /**
   * @param args.cause - The error thrown by `schema.parse`.
   * @param args.url   - The request URL.
   */
  constructor(args: { cause: unknown; url: string }) {
    const causeMessage = args.cause instanceof Error ? args.cause.message : String(args.cause);
    super({
      cause: args.cause,
      message: `Response body from ${args.url} failed validation: ${causeMessage}`,
      url: args.url,
    });
  }
}

/**
 * Discriminated union of every error `safeFetch` can return. Use with
 * `matchError` from `better-result` for compile-checked exhaustive handling.
 */
export type FetchError =
  | AbortError
  | HttpError
  | NetworkError
  | ParseError
  | TimeoutError
  | ValidationError;
