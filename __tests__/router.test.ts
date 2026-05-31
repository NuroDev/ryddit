import { createExecutionContext, env, waitOnExecutionContext } from "cloudflare:test";
import { http, HttpResponse } from "msw";
import { describe, expect, it } from "vitest";
import { REPO_URL } from "~/constants";
import { app } from "~/router";

import { imagePost, videoPost } from "./fixtures";
import { server } from "./mocks/server";

const CRAWLER = {
  "user-agent": "Discordbot/2.0 (+https://discordapp.com)",
};
const BROWSER = {
  "user-agent": "Mozilla/5.0 (X11; Linux x86_64; rv:128.0) Gecko/20100101 Firefox/128.0",
};

describe("router", () => {
  it("redirects the root to the project repo", async () => {
    const res = await app.request("/", {}, env);
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe(REPO_URL);
  });

  it("serves OpenGraph HTML to crawlers", async () => {
    server.use(
      http.get("https://oauth.reddit.com/r/test/comments/img001.json", () =>
        HttpResponse.json(imagePost),
      ),
    );

    const ctx = createExecutionContext();
    const res = await app.request(
      "/r/test/comments/img001/an_image",
      { headers: CRAWLER },
      env,
      ctx,
    );
    await waitOnExecutionContext(ctx);

    expect(res.status).toBe(200);
    const html = (await res.text()).replace(/\s+/g, " ");
    expect(html).toContain('<meta property="og:title" content="An image"/>');
    expect(html).toContain("og:image");
  });

  it("redirects real browsers to Reddit without fetching", async () => {
    const res = await app.request("/r/test/comments/img001/an_image", { headers: BROWSER }, env);

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe(
      "https://www.reddit.com/r/test/comments/img001/an_image",
    );
  });

  it("strips a trailing slash with a 301 redirect", async () => {
    const res = await app.request("/r/test/comments/img001/an_image/", { headers: BROWSER }, env);

    expect(res.status).toBe(301);
    expect(res.headers.get("location")).toMatch(/\/r\/test\/comments\/img001\/an_image$/);
  });

  it("redirects the /v/ proxy to the Reddit fallback MP4", async () => {
    server.use(
      http.get("https://oauth.reddit.com/comments/vid001.json", () => HttpResponse.json(videoPost)),
    );

    const res = await app.request("/v/vid001", {}, env);

    expect(res.status).toBe(302);
    expect(res.headers.get("location")).toBe("https://v.redd.it/xyz/DASH_720.mp4?source=fallback");
  });

  it("serves oEmbed JSON", async () => {
    const res = await app.request("/oembed?author=u%2Ffoo&provider=r%2Ftest", {}, env);

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      author_name: "u/foo",
      provider_name: "r/test",
      type: "link",
    });
  });
});
