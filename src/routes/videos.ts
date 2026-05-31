import { fetchPostById, fetchPostByPermalink } from "~/reddit/client";
import { parsePost } from "~/reddit/parse";
import { createApp } from "~/utils/hono";

export const videoIdRoute = createApp().get("/v/:id", async (c) => {
  const result = await fetchPostById(c.env, c.req.param("id"));
  if (result.isErr()) return c.notFound();

  const post = parsePost(result.value);
  if (!post?.video) return c.notFound();

  return c.redirect(post.video.fallbackUrl, 302);
});

export const videoSubIdRoute = createApp().get("/v/r/:sub/comments/:id", async (c) => {
  const { id, sub } = c.req.param();

  const result = await fetchPostByPermalink(c.env, sub, id);
  if (result.isErr()) return c.notFound();

  const post = parsePost(result.value);
  if (!post?.video) return c.notFound();

  return c.redirect(post.video.fallbackUrl, 302);
});
