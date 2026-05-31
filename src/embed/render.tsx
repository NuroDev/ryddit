import { raw } from "hono/html";
import type { PropsWithChildren } from "hono/jsx";
import type { JSX } from "hono/jsx/jsx-runtime";
import { REDDIT_BASE, THEME_COLOR } from "~/constants";
import { buildOEmbedHref } from "~/embed/oembed";
import type { Post } from "~/reddit/parse";

/**
 * Renders a {@link Post} into an HTML document carrying OpenGraph/Twitter-Card
 * metadata for link-preview crawlers. `origin` is the request's own origin
 * (e.g. `https://ryddit.example.com`), used for the `/v/` video proxy and the
 * oEmbed discovery URL - never hardcoded, so the worker runs on any domain.
 *
 * @param post The normalized post to render.
 * @param origin The request's own origin, used for `/v/` and oEmbed URLs.
 *
 * @returns The embed HTML document.
 */
export function renderPost(post: Post, origin: string): JSX.Element {
  const canonical = new URL(post.permalink, REDDIT_BASE).href;
  const title = post.nsfw ? `🔞 ${post.title}` : post.title;
  const description = post.description || `r/${post.subreddit}`;

  return (
    <Document canonical={canonical}>
      <meta property="og:site_name" content={`r/${post.subreddit}`} />
      <meta property="og:url" content={canonical} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta name="theme-color" content={THEME_COLOR} />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <Media post={post} origin={origin} />
      <title>{title}</title>
      <link href={buildOEmbedHref(origin, post)} rel="alternate" type="application/json+oembed" />
    </Document>
  );
}

/**
 * Renders a minimal fallback embed when a post can't be loaded, so crawlers
 * still get something with a link back to Reddit.
 *
 * @param redditUrl The canonical Reddit URL to link back to.
 *
 * @returns The fallback HTML document.
 */
export function renderError(redditUrl: string): JSX.Element {
  return (
    <Document canonical={redditUrl}>
      <title>ryddit</title>
      <meta property="og:title" content="Reddit post unavailable" />
      <meta property="og:description" content="This post could not be loaded." />
    </Document>
  );
}

/**
 * The shared document shell: doctype, `<head>` with the given tags, canonical.
 *
 * @param props.canonical The canonical Reddit URL for the `<link rel="canonical">`.
 * @param props.children The `<head>` tags (title + OpenGraph/Twitter meta).
 *
 * @returns The full HTML document.
 */
function Document(props: PropsWithChildren<{ canonical: string }>): JSX.Element {
  return (
    <>
      {raw("<!DOCTYPE html>")}
      <html lang="en">
        <head>
          <meta charset="utf-8" />
          <meta name="viewport" content="width=device-width, initial-scale=1" />
          {props.children}
          <link rel="canonical" href={props.canonical} />
        </head>
        <body />
      </html>
    </>
  );
}

/**
 * Renders the media-specific OpenGraph/Twitter tags for a post: inline video
 * tags (pointing at the `/v/` proxy) for videos, otherwise an image card.
 *
 * @param props.origin The request's own origin, used for the `/v/` video proxy URL.
 * @param props.post The post whose media tags to render.
 *
 * @returns The media `<meta>` tags.
 */
function Media(props: { origin: string; post: Post }): JSX.Element {
  const { origin, post } = props;

  if (post.kind === "video" && post.video) {
    const proxy = `${origin}/v/${post.id}`;
    return (
      <>
        <meta property="og:type" content="video.other" />
        <meta property="og:video" content={proxy} />
        <meta property="og:video:url" content={proxy} />
        <meta property="og:video:secure_url" content={proxy} />
        <meta property="og:video:type" content="video/mp4" />
        {post.video.width !== undefined && (
          <meta property="og:video:width" content={String(post.video.width)} />
        )}
        {post.video.height !== undefined && (
          <meta property="og:video:height" content={String(post.video.height)} />
        )}
        {post.image && <meta property="og:image" content={post.image.url} />}
        <meta name="twitter:card" content={post.image ? "summary_large_image" : "summary"} />
        {post.image && <meta name="twitter:image" content={post.image.url} />}
      </>
    );
  }

  return <ImageCard image={post.image} />;
}

/**
 * Renders an image-card embed (`summary_large_image`) for a post's primary
 * image, falling back to a plain `summary` card when there's no image.
 *
 * @param props.image The primary image, if any.
 *
 * @returns The image/summary card `<meta>` tags.
 */
function ImageCard(props: { image?: Post["image"] }): JSX.Element {
  const { image } = props;
  if (!image) {
    return (
      <>
        <meta property="og:type" content="article" />
        <meta name="twitter:card" content="summary" />
      </>
    );
  }

  return (
    <>
      <meta property="og:type" content="article" />
      <meta property="og:image" content={image.url} />
      {image.width !== undefined && (
        <meta property="og:image:width" content={String(image.width)} />
      )}
      {image.height !== undefined && (
        <meta property="og:image:height" content={String(image.height)} />
      )}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:image" content={image.url} />
    </>
  );
}
