/**
 * The app: requests in, responses out. Deliberately free of Cloudflare — nothing
 * here touches `env`, `ctx` or the Cache API, which is what lets the whole site be
 * exercised with nothing but vitest. The platform lives in index.ts.
 */

import { createRouter, type Middleware } from "remix/router";

import { fetchBookRecords } from "./atproto";
import { renderShelf, renderUnavailable } from "./render";
import { routes } from "./routes";
import { toShelf } from "./shelf";
import { createHtmlResponse } from "remix/response/html";
import { html } from "remix/html-template";

const HTML = "text/html; charset=utf-8";

/**
 * A year for shared caches, a minute in the browser. Caching is nothing but this
 * header: no Cache API, no stored copies of our own, just what Cloudflare and the
 * browser choose to do with it. The edge copy is dropped by hand via Purge
 * Everything in the dashboard; the short browser TTL is what makes that button
 * appear to work for someone who already has the page open.
 */
export const SHELF_CACHE_CONTROL = "public, max-age=60, s-maxage=31536000";

export const router = createRouter();

router.map(routes, {
  actions: {
    home: {
      handler: () => createHtmlResponse(html`<h1>August Skare</h1>`),
    },
    bookshelf: {
      handler: async () => {
        let body: string;
        try {
          body = renderShelf(toShelf(await fetchBookRecords()));
        } catch (error) {
          console.error("bookshelf render failed", error);
          // Deliberately uncacheable: caching a failure would pin an error page to
          // the edge until someone purged it by hand.
          return new Response(renderUnavailable(), {
            status: 503,
            headers: { "content-type": HTML, "cache-control": "no-store" },
          });
        }

        return new Response(body, {
          headers: {
            "content-type": HTML,
            "cache-control": SHELF_CACHE_CONTROL,
            // A narrower purge lever than Purge Everything, should it ever be wanted.
            "cache-tag": "bookshelf",
          },
        });
      },
    },
  },
});
