import { trimTrailingSlash } from "hono/trailing-slash";
import { REPO_URL } from "~/constants";
import { renderOEmbed } from "~/embed/oembed";
import { commentsIdRoute } from "~/routes/comments";
import { idRoute } from "~/routes/id";
import { subIdRoute, subShareIdRoute } from "~/routes/subs";
import { videoIdRoute, videoSubIdRoute } from "~/routes/videos";
import { createApp } from "~/utils/hono";

export const app = createApp()
  .use(trimTrailingSlash())
  .get("/", (c) => c.redirect(REPO_URL, 307))
  .get("/robots.txt", (c) => c.text("User-agent: *\nDisallow: /\n"))
  .get("/oembed", (c) =>
    c.json(
      renderOEmbed({
        author: c.req.query("author"),
        authorUrl: c.req.query("authorUrl"),
        provider: c.req.query("provider"),
      }),
      200,
      {
        "cache-control": "public, max-age=86400",
      },
    ),
  )
  .route("/", videoIdRoute)
  .route("/", videoSubIdRoute)
  .route("/", subIdRoute)
  .route("/", subShareIdRoute)
  .route("/", commentsIdRoute)
  .route("/", idRoute);
