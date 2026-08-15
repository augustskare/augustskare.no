/**
 * The Cloudflare half of the site: the Worker entry point, and nothing else. What
 * gets served is router.ts's business, and how long it is kept is decided by the
 * Cache-Control headers the router sets — Cloudflare's own HTTP cache honours
 * `s-maxage` at the edge without this file doing anything about it.
 */

import { router } from "./router";

export default {
  fetch(request: Request): Promise<Response> {
    return router.fetch(request);
  },
};
