import { IMAGE_EXTENSION } from "~/constants";
import type { RedditLinkData, RedditPostResponse } from "~/reddit/schema";

/**
 * A single image (preview or gallery item) with optional dimensions.
 */
interface PostImage {
  height?: number;
  url: string;
  width?: number;
}

/**
 * A native Reddit (`v.redd.it`) video. `fallbackUrl` is the muxed-video MP4.
 */
interface PostVideo {
  fallbackUrl: string;
  hasAudio: boolean;
  height?: number;
  width?: number;
}

/**
 * Normalized post model the embed layer renders. Source-agnostic.
 */
export interface Post {
  author: string;
  description: string;
  gallery?: Array<PostImage>;
  id: string;
  /** First/primary image - gallery cover, link thumbnail, or video poster. */
  image?: PostImage;
  kind: "gallery" | "image" | "link" | "text" | "video";
  nsfw: boolean;
  /** Path beginning with `/r/…`, suitable for redirecting to Reddit. */
  permalink: string;
  spoiler: boolean;
  subreddit: string;
  title: string;
  video?: PostVideo;
}

const MAX_DESCRIPTION = 300;

/**
 * Extracts the first usable `t3` post from a Reddit post-page response and normalizes
 * it into a {@link Post}. Returns `null` when there's no post, or it was removed/deleted
 * with nothing left to render.
 *
 * @param response The validated `[postListing, commentListing]` response from Reddit.
 *
 * @returns The normalized {@link Post}, or `null` when there's nothing renderable.
 */
export function parsePost(response: RedditPostResponse): Post | null {
  const data = response[0]?.data.children.find((child) => child.kind === "t3")?.data;

  if (!data?.id || !data.subreddit || !data.permalink) return null;
  if (data.removed_by_category) return null;

  const nsfw = data.over_18 ?? false;
  const previewImage = toImage(data.preview?.images?.[0]?.source);

  let kind: Post["kind"] = "text";
  let image = previewImage;
  let gallery: Array<PostImage> | undefined;
  let video: PostVideo | undefined;

  const redditVideo = (data.media ?? data.secure_media)?.reddit_video;

  if (nsfw) {
    // Don't leak a thumbnail for NSFW posts - render as text/link only.
    kind = data.is_self ? "text" : "link";
    image = undefined;
  } else if (data.is_gallery && data.gallery_data && data.media_metadata) {
    gallery = buildGallery(data.gallery_data, data.media_metadata);
    if (gallery.length > 0) {
      kind = "gallery";
      image = gallery[0];
    } else {
      gallery = undefined;
    }
  } else if (redditVideo) {
    kind = "video";
    video = {
      fallbackUrl: decodeEntities(redditVideo.fallback_url),
      hasAudio: redditVideo.has_audio ?? false,
      height: redditVideo.height,
      width: redditVideo.width,
    };
  } else if (previewImage && isImagePost(data)) {
    kind = "image";
  } else if (!data.is_self && data.url) {
    kind = "link";
  }

  return {
    author: data.author && data.author !== "[deleted]" ? data.author : "[deleted]",
    description: cleanBodyText(data.selftext ?? ""),
    gallery,
    id: data.id,
    image,
    kind,
    nsfw,
    permalink: data.permalink,
    spoiler: data.spoiler ?? false,
    subreddit: data.subreddit,
    title: decodeEntities(data.title ?? ""),
    video,
  };
}

function isImagePost(data: RedditLinkData): boolean {
  if (data.post_hint === "image") return true;
  return data.url ? IMAGE_EXTENSION.test(data.url) : false;
}

function toImage(
  source: { height?: number; url?: string; width?: number } | undefined,
): PostImage | undefined {
  if (!source?.url) return undefined;
  return {
    height: source.height,
    url: decodeEntities(source.url),
    width: source.width,
  };
}

function buildGallery(
  galleryData: NonNullable<RedditLinkData["gallery_data"]>,
  mediaMetadata: NonNullable<RedditLinkData["media_metadata"]>,
): Array<PostImage> {
  const images: Array<PostImage> = [];

  for (const item of galleryData.items) {
    const meta = mediaMetadata[item.media_id];
    if (!meta || (meta.status && meta.status !== "valid")) continue;

    const url = meta.s?.u ?? meta.s?.gif ?? meta.s?.mp4;
    if (!url) continue;

    images.push({
      height: meta.s?.y,
      url: decodeEntities(url),
      width: meta.s?.x,
    });
  }

  return images;
}

/**
 * Cleans selftext for use in a meta description: decodes entities, strips Reddit's `[View Poll]`
 * artifact and trailing spoiler markers, collapses whitespace, and truncates.
 *
 * @param raw The raw `selftext` from Reddit.
 *
 * @returns A single-line description, truncated to {@link MAX_DESCRIPTION} chars.
 */
function cleanBodyText(raw: string): string {
  let text = decodeEntities(raw)
    .replace(/^\s*\[View Poll\]\([^)]*\)/i, "")
    .replace(/\|\|$/, "")
    .replace(/\s+/g, " ")
    .trim();

  if (text.length > MAX_DESCRIPTION) {
    text = `${text.slice(0, MAX_DESCRIPTION - 1).trimEnd()}…`;
  }

  return text;
}

/**
 * Decodes the handful of HTML entities Reddit emits in URLs and text.
 *
 * @param value The entity-encoded string.
 *
 * @returns The decoded string.
 */
function decodeEntities(value: string): string {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&#x200B;", "");
}
