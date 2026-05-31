import { app } from "~/router";

export default {
  fetch: app.fetch,
} satisfies ExportedHandler<Env>;
