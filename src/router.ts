/**
 * The app: requests in, responses out. Deliberately free of Cloudflare — nothing
 * here touches `env`, `ctx` or the Cache API, which is what lets the whole site be
 * exercised with nothing but vitest. The platform lives in index.ts.
 */

import { createHtmlResponse } from "remix/response/html";
import type { SafeHtml } from "remix/html-template";
import { createRouter } from "remix/router";

import { fetchBookRecords } from "./atproto";
import { renderHome, renderShelf, renderUnavailable } from "./render";
import { routes } from "./routes";
import { toShelf } from "./shelf";

/**
 * A year for shared caches, a minute in the browser. Caching is nothing but this
 * header: no Cache API, no stored copies of our own, just what Cloudflare and the
 * browser choose to do with it. The edge copy is dropped by hand via Purge
 * Everything in the dashboard; the short browser TTL is what makes that button
 * appear to work for someone who already has the page open.
 */
export const CACHE_CONTROL = "public, max-age=60, s-maxage=31536000";

/**
 * Every cacheable page answers the same way. The tag is a narrower purge lever
 * than Purge Everything, should it ever be wanted.
 */
function pageResponse(body: SafeHtml, tag: string): Response {
  return createHtmlResponse(body, {
    headers: { "cache-control": CACHE_CONTROL, "cache-tag": tag },
  });
}

export const router = createRouter();

router.map(routes, {
  actions: {
    home: () => pageResponse(renderHome(), "home"),

    bookshelf: async () => {
      try {
        return pageResponse(renderShelf(toShelf(await fetchBookRecords())), "bookshelf");
      } catch (error) {
        console.error("bookshelf render failed", error);
        // Deliberately uncacheable: caching a failure would pin an error page to
        // the edge until someone purged it by hand.
        return createHtmlResponse(renderUnavailable(), {
          status: 503,
          headers: { "cache-control": "no-store" },
        });
      }
    },
  },
});
