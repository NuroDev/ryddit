import { z } from "zod";

/**
 * Zod schemas for the subset of Reddit's listing JSON that ryddit consumes.
 *
 * Reddit returns a great deal more than we model; unknown keys are stripped.
 * Every consumed field is optional/nullable because Reddit's payloads are
 * inconsistent across post types (and the comment listing reuses the same
 * `data` envelope with an entirely different shape). Keeping fields optional
 * means a comment (`t1`) child parses without error rather than failing the
 * whole response.
 */

const PreviewSource = z.object({
  height: z.number().optional(),
  url: z.string(),
  width: z.number().optional(),
});

const Preview = z.object({
  images: z.array(z.object({ source: PreviewSource })).optional(),
});

const RedditVideo = z.object({
  fallback_url: z.string(),
  has_audio: z.boolean().optional(),
  height: z.number().optional(),
  width: z.number().optional(),
});

const Media = z.object({
  reddit_video: RedditVideo.optional(),
});

const MediaMetadataItem = z.object({
  /** Element type: `Image` | `AnimatedImage` | `RedditVideo` | … */
  e: z.string().optional(),
  /** MIME type, e.g. `image/jpg`. */
  m: z.string().optional(),
  /** Source variant: `u` (still), `gif`, `mp4`, plus `x`/`y` dimensions. */
  s: z
    .object({
      gif: z.string().optional(),
      mp4: z.string().optional(),
      u: z.string().optional(),
      x: z.number().optional(),
      y: z.number().optional(),
    })
    .optional(),
  status: z.string().optional(),
});

const GalleryData = z.object({
  items: z.array(
    z.object({
      caption: z.string().optional(),
      media_id: z.string(),
    }),
  ),
});

/**
 * A Reddit `t3` link's `data` object (also loosely covers `t1` comments)
 */
const RedditLinkData = z.object({
  author: z.string().optional(),
  created_utc: z.number().optional(),
  domain: z.string().optional(),
  gallery_data: GalleryData.nullable().optional(),
  id: z.string().optional(),
  is_gallery: z.boolean().optional(),
  is_self: z.boolean().optional(),
  is_video: z.boolean().optional(),
  media: Media.nullable().optional(),
  media_metadata: z.record(z.string(), MediaMetadataItem).nullable().optional(),
  name: z.string().optional(),
  num_comments: z.number().optional(),
  over_18: z.boolean().optional(),
  permalink: z.string().optional(),
  post_hint: z.string().optional(),
  preview: Preview.optional(),
  removed_by_category: z.string().nullable().optional(),
  score: z.number().optional(),
  secure_media: Media.nullable().optional(),
  selftext: z.string().optional(),
  spoiler: z.boolean().optional(),
  subreddit: z.string().optional(),
  thumbnail: z.string().optional(),
  title: z.string().optional(),
  url: z.string().optional(),
});

const Listing = z.object({
  data: z.object({
    children: z.array(z.object({ data: RedditLinkData, kind: z.string() })),
  }),
  kind: z.string().optional(),
});

/**
 * A post-page response: `[postListing, commentListing]`. Modelled as an array
 * (min 1) rather than a strict 2-tuple so a shape change on Reddit's side
 * doesn't reject an otherwise-usable post.
 */
export const RedditPostResponseSchema = z.array(Listing).min(1);

export type RedditPostResponse = z.infer<typeof RedditPostResponseSchema>;
export type RedditLinkData = z.infer<typeof RedditLinkData>;
