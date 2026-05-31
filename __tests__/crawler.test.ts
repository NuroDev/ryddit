import { describe, expect, it } from "vitest";
import { isCrawler } from "~/utils/crawler";

describe("isCrawler", () => {
  it("detects link-preview crawlers", () => {
    for (const ua of [
      "Discordbot/2.0 (+https://discordapp.com)",
      "facebookexternalhit/1.1",
      "Slackbot-LinkExpanding 1.0",
      "TelegramBot (like TwitterBot)",
      "Twitterbot/1.0",
      "WhatsApp/2.23",
    ]) {
      expect(isCrawler(ua)).toBe(true);
    }
  });

  it("treats real browsers as non-crawlers", () => {
    const chrome =
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36";
    expect(isCrawler(chrome)).toBe(false);
  });

  it("handles missing User-Agent", () => {
    expect(isCrawler(null)).toBe(false);
    expect(isCrawler(undefined)).toBe(false);
    expect(isCrawler("")).toBe(false);
  });
});
