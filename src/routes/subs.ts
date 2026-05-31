import { Result } from "better-result";
import { REDDIT_BASE } from "~/constants";
import { buildEmbed } from "~/embed/build";
import { cachePost } from "~/middleware/cache";
import { fetchPostByPermalink, resolveShareLink, ShareLinkError } from "~/reddit/client";
import { isCrawler } from "~/utils/crawler";
import { createApp } from "~/utils/hono";
import { parsePermalink } from "~/utils/permalink";

export const subIdRoute = createApp().get("/r/:sub/comments/:id/:slug?", cachePost, (c) => {
  const { id, slug, sub } = c.req.param();
  const redditUrl = new URL(`/r/${sub}/comments/${id}${slug ? `/${slug}` : ""}`, REDDIT_BASE);

  const isBot = isCrawler(c.req.header("user-agent"));
  if (!isBot) return c.redirect(redditUrl, 302);

  return buildEmbed(c, redditUrl, () => fetchPostByPermalink(c.env, sub, id));
});

export const subShareIdRoute = createApp().get("/r/:sub/s/:shareId", cachePost, (c) => {
  const { shareId, sub } = c.req.param();
  const redditUrl = new URL(`/r/${sub}/s/${shareId}`, REDDIT_BASE);

  const isBot = isCrawler(c.req.header("user-agent"));
  if (!isBot) return c.redirect(redditUrl, 302);

  return buildEmbed(c, redditUrl, async () => {
    const resolved = await resolveShareLink(c.env, sub, shareId);
    if (resolved.isErr()) return Result.err(resolved.error);

    const permalink = parsePermalink(resolved.value);
    if (!permalink) return Result.err(new ShareLinkError({ url: resolved.value }));

    return fetchPostByPermalink(c.env, permalink.subreddit, permalink.id);
  });
});
