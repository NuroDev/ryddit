import { describe, expect, it } from "vitest";
import { buildOEmbedHref, renderOEmbed } from "~/embed/oembed";
import type { Post } from "~/reddit/parse";

describe("oembed", () => {
  it("builds a discovery href carrying byline params", () => {
    const post = { author: "bob", subreddit: "test" } as Post;
    const href = buildOEmbedHref("https://ryddit.test", post);
    expect(href).toContain("https://ryddit.test/oembed?");
    expect(href).toContain("author=u%2Fbob");
    expect(href).toContain("provider=r%2Ftest");
  });

  it("renders oEmbed JSON from params", () => {
    const oembed = renderOEmbed({
      author: "u/bob",
      authorUrl: "https://www.reddit.com/u/bob",
      provider: "r/test",
    });
    expect(oembed).toMatchObject({
      author_name: "u/bob",
      provider_name: "r/test",
      type: "link",
      version: "1.0",
    });
  });

  it("falls back to defaults when params are absent", () => {
    const oembed = renderOEmbed({});
    expect(oembed.provider_name).toBe("ryddit");
    expect(oembed.author_name).toBe("");
  });
});
