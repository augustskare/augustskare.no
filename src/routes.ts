/**
 * Every route the Worker answers. Everything else the site serves is a file in
 * public/, handed out by Cloudflare's asset layer without ever waking this code —
 * `assets.run_worker_first` in wrangler.jsonc is what decides which is which, so
 * the two lists have to be kept in step.
 */

import { route, get } from "remix/routes";

export const routes = route({
  home: get("/index"),
  bookshelf: get("/bookshelf"),
});
