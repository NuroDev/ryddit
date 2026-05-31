import { createFactory } from "hono/factory";

export const {
  //
  createApp,
  createHandlers,
  createMiddleware,
} = createFactory<{
  Bindings: Env;
  Variables: {};
}>();
