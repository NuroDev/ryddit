import { describe, expect, it } from "vitest";
import { parsePermalink } from "~/utils/permalink";

describe("parsePermalink", () => {
  it("extracts subreddit and id from a full permalink with slug + trailing slash", () => {
    expect(
      parsePermalink("https://www.reddit.com/r/rust/comments/1tsfp7t/created_knodiq_a_daw/"),
    ).toEqual({ id: "1tsfp7t", subreddit: "rust" });
  });

  it("parses a bare path", () => {
    expect(parsePermalink("/r/golang/comments/abc123/title")).toEqual({
      id: "abc123",
      subreddit: "golang",
    });
  });

  it("parses a permalink without a slug", () => {
    expect(parsePermalink("https://www.reddit.com/r/rust/comments/1tsfp7t")).toEqual({
      id: "1tsfp7t",
      subreddit: "rust",
    });
  });

  it("returns null when there is no comments permalink", () => {
    expect(parsePermalink("https://www.reddit.com/r/rust/")).toBeNull();
    expect(parsePermalink("https://example.com/foo/bar")).toBeNull();
    expect(parsePermalink("/r/rust/s/abc123")).toBeNull();
  });
});
