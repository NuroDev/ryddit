import { describe, expect, it } from "vitest";
import { renderPost } from "~/embed/render";
import type { Post } from "~/reddit/parse";

const ORIGIN = "https://ryddit.test";

function basePost(overrides: Partial<Post>): Post {
  return {
    author: "alice",
    description: "desc",
    id: "abc123",
    kind: "text",
    nsfw: false,
    permalink: "/r/test/comments/abc123/title/",
    spoiler: false,
    subreddit: "test",
    title: "Title",
    ...overrides,
  };
}

/**
 * Renders and collapses whitespace, so assertions ignore HTML formatting
 *
 * @param post The post to render.
 *
 * @returns The rendered HTML with runs of whitespace collapsed to single spaces.
 */
function render(post: Post): string {
  return String(renderPost(post, ORIGIN)).replace(/\s+/g, " ");
}

describe("renderPost", () => {
  it("emits core OpenGraph + canonical tags", () => {
    const html = render(basePost({}));
    expect(html).toContain('<meta property="og:title" content="Title"/>');
    expect(html).toContain(
      '<link rel="canonical" href="https://www.reddit.com/r/test/comments/abc123/title/"/>',
    );
    expect(html).toContain("application/json+oembed");
  });

  it("renders an image card", () => {
    const html = render(basePost({ image: { url: "https://i.redd.it/x.jpg" }, kind: "image" }));
    expect(html).toContain('<meta property="og:image" content="https://i.redd.it/x.jpg"/>');
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image"/>');
  });

  it("points og:video at the /v/ proxy on our origin", () => {
    const html = render(
      basePost({
        kind: "video",
        video: { fallbackUrl: "https://v.redd.it/x/DASH.mp4", hasAudio: true },
      }),
    );
    expect(html).toContain(
      '<meta property="og:video:secure_url" content="https://ryddit.test/v/abc123"/>',
    );
    expect(html).toContain('<meta property="og:video:type" content="video/mp4"/>');
  });

  it("escapes HTML in the title", () => {
    const html = render(basePost({ title: '<script>"hi"' }));
    expect(html).toContain("&lt;script&gt;&quot;hi&quot;");
    expect(html).not.toContain("<script>");
  });

  it("prefixes NSFW posts", () => {
    const html = render(basePost({ nsfw: true, title: "Spicy" }));
    expect(html).toContain("🔞 Spicy");
  });
});
