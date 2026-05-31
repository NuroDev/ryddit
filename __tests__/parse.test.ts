import { describe, expect, it } from "vitest";
import { parsePost } from "~/reddit/parse";
import { RedditPostResponseSchema } from "~/reddit/schema";

import { galleryPost, imagePost, noPostResponse, nsfwPost, textPost, videoPost } from "./fixtures";

function parse(raw: unknown) {
  return parsePost(RedditPostResponseSchema.parse(raw));
}

describe("parsePost", () => {
  it("parses a text post and cleans the body", () => {
    const post = parse(textPost);
    expect(post?.kind).toBe("text");
    // entities decoded, trailing spoiler markers stripped
    expect(post?.description).toBe("Just some text & more");
    expect(post?.image).toBeUndefined();
    expect(post?.author).toBe("alice");
  });

  it("parses an image post and decodes the preview URL", () => {
    const post = parse(imagePost);
    expect(post?.kind).toBe("image");
    expect(post?.image?.url).toBe("https://preview.redd.it/abc.jpg?width=640&s=tok");
    expect(post?.image?.width).toBe(1200);
    expect(post?.image?.height).toBe(800);
  });

  it("parses a gallery into ordered images", () => {
    const post = parse(galleryPost);
    expect(post?.kind).toBe("gallery");
    expect(post?.gallery).toHaveLength(2);
    expect(post?.image?.url).toBe("https://preview.redd.it/m1.jpg?s=a&b=c");
    expect(post?.gallery?.[1]?.url).toBe("https://preview.redd.it/m2.jpg?s=d&b=e");
  });

  it("parses a native video with its fallback URL", () => {
    const post = parse(videoPost);
    expect(post?.kind).toBe("video");
    expect(post?.video?.fallbackUrl).toBe("https://v.redd.it/xyz/DASH_720.mp4?source=fallback");
    expect(post?.video?.hasAudio).toBe(true);
    expect(post?.video?.width).toBe(1280);
  });

  it("marks NSFW posts and withholds the thumbnail", () => {
    const post = parse(nsfwPost);
    expect(post?.nsfw).toBe(true);
    expect(post?.image).toBeUndefined();
    expect(post?.kind).toBe("link");
  });

  it("returns null when there is no post", () => {
    expect(parse(noPostResponse)).toBeNull();
  });
});
