import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

/**
 * Default handlers persist across `resetHandlers()`. The app-only OAuth token
 * endpoint is mocked here so every test gets a token without re-declaring it.
 */
export const server = setupServer(
  http.post("https://www.reddit.com/api/v1/access_token", () =>
    HttpResponse.json({
      access_token: "test-token",
      expires_in: 3600,
      token_type: "bearer",
    }),
  ),
);
