/**
 * Raw Reddit post-page responses (`[postListing, commentListing]`) used across
 * the parse/render/router tests. Shapes mirror what `www.reddit.com/…json`
 * returns, trimmed to the fields ryddit consumes.
 */

/**
 * Wraps a `t3` link `data` object in the two-listing response envelope
 *
 * @param data The `t3` link's `data` object (the post fields under test).
 *
 * @returns A `[postListing, commentListing]` response, with an empty comment listing.
 */
export function listing(data: Record<string, unknown>): Array<unknown> {
  return [
    {
      data: {
        children: [
          {
            data,
            kind: "t3",
          },
        ],
      },
      kind: "Listing",
    },
    {
      data: {
        children: [],
      },
      kind: "Listing",
    },
  ];
}

export const textPost = listing({
  author: "alice",
  id: "txt001",
  is_self: true,
  permalink: "/r/test/comments/txt001/a_text_post/",
  selftext: "Just some text &amp; more ||",
  subreddit: "test",
  title: "A text post",
});

export const imagePost = listing({
  author: "bob",
  id: "img001",
  permalink: "/r/test/comments/img001/an_image/",
  post_hint: "image",
  preview: {
    images: [
      {
        source: {
          height: 800,
          url: "https://preview.redd.it/abc.jpg?width=640&amp;s=tok",
          width: 1200,
        },
      },
    ],
  },
  subreddit: "test",
  title: "An image",
  url: "https://i.redd.it/abc.jpg",
});

export const galleryPost = listing({
  author: "carol",
  gallery_data: {
    items: [
      {
        media_id: "m1",
      },
      {
        media_id: "m2",
      },
    ],
  },
  id: "gal001",
  is_gallery: true,
  media_metadata: {
    m1: {
      e: "Image",
      s: {
        u: "https://preview.redd.it/m1.jpg?s=a&amp;b=c",
        x: 800,
        y: 600,
      },
      status: "valid",
    },
    m2: {
      e: "Image",
      s: {
        u: "https://preview.redd.it/m2.jpg?s=d&amp;b=e",
        x: 400,
        y: 300,
      },
      status: "valid",
    },
  },
  permalink: "/r/test/comments/gal001/a_gallery/",
  subreddit: "test",
  title: "A gallery",
});

export const videoPost = listing({
  author: "dave",
  id: "vid001",
  is_video: true,
  media: {
    reddit_video: {
      fallback_url: "https://v.redd.it/xyz/DASH_720.mp4?source=fallback",
      has_audio: true,
      height: 720,
      width: 1280,
    },
  },
  permalink: "/r/test/comments/vid001/a_video/",
  subreddit: "test",
  title: "A video",
});

export const nsfwPost = listing({
  author: "erin",
  id: "nsfw01",
  over_18: true,
  permalink: "/r/test/comments/nsfw01/a_spicy_link/",
  post_hint: "image",
  preview: {
    images: [
      {
        source: {
          height: 800,
          url: "https://preview.redd.it/secret.jpg?s=tok",
          width: 1200,
        },
      },
    ],
  },
  subreddit: "test",
  title: "A spicy link",
  url: "https://example.com/spicy",
});

export const noPostResponse = [
  {
    data: {
      children: [],
    },
    kind: "Listing",
  },
];
