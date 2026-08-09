import { fetchBookRecords } from "./atproto";
import { renderShelf, renderUnavailable } from "./render";
import { toShelf } from "./shelf";

const SHELF_PATH = "/bookshelf";

/**
 * A year at the edge, a minute in the browser. The edge copy is dropped by hand
 * via Purge Everything in the Cloudflare dashboard; the short browser TTL is what
 * makes that button appear to work for someone who already has the page open.
 */
const SHELF_CACHE_CONTROL = "public, max-age=60, s-maxage=31536000";

const HTML = "text/html; charset=utf-8";

export default {
  async fetch(request: Request, _env: unknown, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // `run_worker_first` routes `/bookshelf/*` here too, so anything below the
    // shelf lands in this handler and has to be turned away explicitly.
    if (url.pathname !== SHELF_PATH) {
      return new Response("Not found", {
        status: 404,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed", { status: 405, headers: { allow: "GET, HEAD" } });
    }

    // The shelf is one page, so it gets exactly one cache entry regardless of what
    // the request looked like. Two reasons this cannot just be `request`: the Cache
    // API rejects `put()` for anything but GET, so a HEAD would throw; and a query
    // string would otherwise mint a fresh entry — and a fresh crawl of the PDS —
    // for every `/bookshelf?anything` an unfriendly visitor cared to invent.
    const cacheKey = new Request(new URL(SHELF_PATH, url.origin), { method: "GET" });

    const cache = caches.default;
    const cached = await cache.match(cacheKey);
    if (cached) return cached;

    let body: string;
    try {
      body = renderShelf(toShelf(await fetchBookRecords()));
    } catch (error) {
      console.error("bookshelf render failed", error);
      // Deliberately uncacheable: with no stored copy to fall back on, caching a
      // failure would pin an error page to the edge until someone purged by hand.
      return new Response(renderUnavailable(), {
        status: 503,
        headers: { "content-type": HTML, "cache-control": "no-store" },
      });
    }

    const response = new Response(body, {
      headers: {
        "content-type": HTML,
        "cache-control": SHELF_CACHE_CONTROL,
        // A narrower purge lever than Purge Everything, should it ever be wanted.
        "cache-tag": "bookshelf",
      },
    });

    // The Cache API needs an explicit put — a Cache-Control header alone caches
    // nothing, because a Worker runs after the caching decision has been made.
    ctx.waitUntil(cache.put(cacheKey, response.clone()));
    return response;
  },
};
