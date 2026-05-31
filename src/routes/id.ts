import { REDDIT_BASE } from "~/constants";
import { buildEmbed } from "~/embed/build";
import { cachePost } from "~/middleware/cache";
import { fetchPostById } from "~/reddit/client";
import { isCrawler } from "~/utils/crawler";
import { createApp } from "~/utils/hono";

export const idRoute = createApp().get("/:id", cachePost, (c) => {
  const { id } = c.req.param();
  if (id.includes(".")) return c.notFound();

  const redditUrl = new URL(`/comments/${id}`, REDDIT_BASE);

  const isBot = isCrawler(c.req.header("user-agent"));
  if (!isBot) return c.redirect(redditUrl, 302);

  return buildEmbed(c, redditUrl, () => fetchPostById(c.env, id));
});
