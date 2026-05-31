import { Result } from "better-result";
import {
  AbortError,
  HttpError,
  NetworkError,
  ParseError,
  TimeoutError,
  ValidationError,
  type BodyFormat,
  type FetchError,
} from "./errors";

export type { FetchError };

/**
 * Maps a {@link BodyFormat} literal to the value returned by the matching
 * `Response` body reader.
 */
export type BodyFormatReturnType<F extends BodyFormat> = {
  arrayBuffer: ArrayBuffer;
  blob: Blob;
  formData: FormData;
  json: unknown;
  text: string;
}[F];

/**
 * Options for {@link safeFetch}. Extends the standard {@link RequestInit} with
 * status-acceptance, body-parsing, schema-validation, and timeout controls.
 */
export interface SafeFetchOptions extends RequestInit {
  /**
   * Predicate used to decide whether a response status counts as success.
   * When the predicate returns `false`, `safeFetch` resolves to
   * `Err(HttpError)`.
   *
   * @defaultValue `(status) => status >= 200 && status < 300`
   */
  acceptStatus?: (status: number) => boolean;

  /**
   * Body reader to invoke on the successful response. When omitted (and no
   * `schema` is provided), `safeFetch` resolves to `Ok(Response)` and the
   * caller is responsible for reading the body.
   */
  as?: BodyFormat;

  /**
   * Validator applied to the parsed body. Any object exposing a
   * `parse(input: unknown): T` method works - zod, valibot, arktype, or a
   * hand-rolled validator. When provided without `as`, `as` defaults to
   * `'json'`. Throws inside `parse` are caught and surfaced as
   * `Err(ValidationError)`.
   */
  schema?: { parse: (input: unknown) => unknown };

  /**
   * Request timeout in milliseconds. Composed with `signal` via
   * {@link AbortSignal.any}, so a caller-provided abort and a timeout are
   * disambiguated into `AbortError` vs `TimeoutError`.
   */
  timeout?: number;
}

/**
 * Computes the success type produced by {@link safeFetch} from the option
 * shape.
 *
 * - `schema: { parse }` → the schema's parsed return type
 * - `as: F` → {@link BodyFormatReturnType} for `F`
 * - neither → `Response`
 */
export type FetchSuccess<O> = O extends {
  schema: { parse: (input: unknown) => infer T };
}
  ? T
  : O extends { as: infer F extends BodyFormat }
    ? BodyFormatReturnType<F>
    : Response;

/**
 * Computes the error union produced by {@link safeFetch} from the option
 * shape. An error tag is only included when the option that triggers it is
 * present:
 *
 * - {@link NetworkError}, {@link HttpError} - always possible
 * - {@link TimeoutError} - when `timeout` is set
 * - {@link AbortError} - when `signal` is set
 * - {@link ParseError} - when `as` or `schema` is set
 * - {@link ValidationError} - when `schema` is set
 *
 * Narrowing is shape-based: an option typed as e.g. `AbortSignal | undefined`
 * does not include {@link AbortError} unless its type is provably assignable
 * to `AbortSignal`. Pass options as object literals (or assert the shape) to
 * get the tightest union.
 */
export type FetchErrorFor<O> =
  | NetworkError
  | HttpError
  | (O extends { timeout: number } ? TimeoutError : never)
  | (O extends { signal: AbortSignal } ? AbortError : never)
  | (O extends { as: BodyFormat } | { schema: { parse: (input: unknown) => unknown } }
      ? ParseError
      : never)
  | (O extends { schema: { parse: (input: unknown) => unknown } } ? ValidationError : never);

/**
 * Wraps {@link fetch} so every failure mode (network, timeout, abort,
 * non-2xx, body parse, schema validation) surfaces as a discriminated
 * `TaggedError` inside a {@link Result}. Never throws.
 *
 * The returned `Result`'s success and error types are derived from `init`:
 *
 * - Success: {@link FetchSuccess} - `Response`, the body-reader return type,
 *   or the schema's parse return type.
 * - Error: {@link FetchErrorFor} - only the error tags whose triggering
 *   option is present in `init`.
 *
 * @param input - The URL, {@link URL} instance, or {@link Request} to send.
 * @param init  - Standard {@link RequestInit} fields plus `acceptStatus`, `as`, `schema`, and `timeout`.
 *
 * @returns A promise that resolves to a {@link Result} - `Ok` on success, `Err` on any failure.
 *
 * @example Plain `Response` - only `NetworkError | HttpError`
 * ```ts
 * const result = await safeFetch('https://api.example.com/health');
 * if (result.isErr()) {
 *     return matchError(result.error, {
 *         HttpError: (e) => `server said ${e.status}`,
 *         NetworkError: (e) => `offline: ${e.message}`,
 *     });
 * }
 * console.log(await result.value.text());
 * ```
 *
 * @example Parse JSON with a schema and a timeout - adds `ParseError`, `ValidationError`, `TimeoutError`
 * ```ts
 * import { z } from 'zod';
 *
 * const User = z.object({ id: z.string(), name: z.string() });
 *
 * const user = await safeFetch('https://api.example.com/me', {
 *     headers: { authorization: `Bearer ${token}` },
 *     schema: User,
 *     timeout: 5_000,
 * });
 * if (user.isOk()) console.log(user.value.name);
 * ```
 */
export function safeFetch<const O extends SafeFetchOptions = SafeFetchOptions>(
  input: RequestInfo | URL,
  init?: O,
): Promise<Result<FetchSuccess<O>, FetchErrorFor<O>>>;

export async function safeFetch(
  input: RequestInfo | URL,
  init?: SafeFetchOptions,
): Promise<Result<unknown, FetchError>> {
  const url = resolveUrl(input);
  const {
    acceptStatus = defaultAcceptStatus,
    as,
    schema,
    signal: userSignal,
    timeout,
    ...requestInit
  } = init ?? {};

  const timeoutSignal = timeout !== undefined ? AbortSignal.timeout(timeout) : undefined;
  const signal = composeSignals(timeoutSignal, userSignal ?? undefined);

  let response: Response;
  try {
    response = await fetch(input, { ...requestInit, signal });
  } catch (cause) {
    if (signal?.aborted) {
      const reason: unknown = signal.reason;
      const isTimeout = reason instanceof DOMException && reason.name === "TimeoutError";
      if (isTimeout && timeout !== undefined)
        return Result.err(
          new TimeoutError({
            timeoutMs: timeout,
            url,
          }),
        );

      return Result.err(new AbortError({ url }));
    }

    return Result.err(
      new NetworkError({
        cause,
        url,
      }),
    );
  }

  if (!acceptStatus(response.status))
    return Result.err(
      new HttpError({
        response,
        url,
      }),
    );

  const effectiveAs: BodyFormat | undefined = as ?? (schema ? "json" : undefined);
  if (effectiveAs === undefined) return Result.ok(response);

  let body: unknown;
  try {
    body = await response[effectiveAs]();
  } catch (cause) {
    return Result.err(
      new ParseError({
        as: effectiveAs,
        cause,
        url,
      }),
    );
  }

  if (schema) {
    try {
      return Result.ok(schema.parse(body));
    } catch (cause) {
      return Result.err(
        new ValidationError({
          cause,
          url,
        }),
      );
    }
  }

  return Result.ok(body);
}

function defaultAcceptStatus(status: number): boolean {
  return status >= 200 && status < 300;
}

function resolveUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

function composeSignals(
  a: AbortSignal | undefined,
  b: AbortSignal | undefined,
): AbortSignal | undefined {
  if (a && b) return AbortSignal.any([a, b]);
  return a ?? b;
}
