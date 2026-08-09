---
id: T2
title: How Workers Static Assets and a single dynamic route coexist
type: research
status: closed
assignee: claude (research agent, 2026-08-09)
blocked-by: []
---

## Question

The site is one Worker serving two things: hand-written static files (`index.html`, a shared
stylesheet, `hubot.woff2`) and one dynamic route, `/bookshelf`. Establish how Cloudflare's
Workers Static Assets makes that work.

1. What `wrangler.jsonc` config binds an assets directory, and what are the routing semantics
   between assets and Worker code? Cover `assets.directory`, `assets.binding`,
   `run_worker_first`, and `not_found_handling`.
2. Which requests **invoke the Worker** and which are served straight from assets without
   running code? Specifically: does a request for `/bookshelf` reach the Worker when no asset
   matches that path?
3. How are static assets cached by Cloudflare, and can that caching be controlled? Does it
   interact with whatever cache layer T1 picks for the dynamic route?
4. What is served for **404s** — the assets `not_found_handling` behaviour vs the Worker's own
   fallback. The site currently gets Pages' 404 behaviour for free; the Worker must choose one.
5. Does `wrangler dev` serve assets locally in a way that can replace the current
   `http-server site` dev command?
6. Any constraint that would push `index.html` out of being a plain hand-edited file — the
   decision in the destination grilling was that it stays one.

Answer shapes the repo restructure (T6) and may open questions about who owns `/`.

## Resolution

**The split works and `index.html` stays a plain hand-edited file.** Full evidence, including a
reading of the actual routing code in `cloudflare/workers-sdk`:
[`research/T2-static-assets-alongside-worker-route.md`](../research/T2-static-assets-alongside-worker-route.md).

```jsonc
"assets": {
  "directory": "./public",
  "binding": "ASSETS",
  "not_found_handling": "404-page",
  "run_worker_first": ["/bookshelf", "/bookshelf/*"]
}
```

Resulting routing: `/` serves `public/index.html` with **no Worker invocation**; CSS and font
likewise; `/bookshelf` always reaches the Worker; every other path gets a hand-written
`public/404.html` with a 404 status, again without running code. Static asset requests are free and
unmetered, so the Free plan's request budget is consumed by `/bookshelf` alone.

### The trap — `run_worker_first` is not optional

Since compatibility date `2025-04-01`, `assets_navigation_prefers_asset_serving` is on by default.
With it on **and** `not_found_handling` set to anything but `none`, a _navigation_ request
(`Sec-Fetch-Mode: navigate` — what a browser sends when you type a URL) that matches no asset is
answered by the asset fallback and **the Worker never runs**.

So `not_found_handling: "404-page"` on its own would serve `404.html` to every human who visits
`/bookshelf` in a browser, while `fetch("/bookshelf")` from JS worked perfectly — a bug that
survives every scripted test and fails for every real visitor. Listing the path in
`run_worker_first` routes it to the Worker before that logic runs. Confirmed both in the docs and
in `canFetch` in `workers-shared/asset-worker/src/handler.ts`.

### Other findings

- Assets are uploaded byte-for-byte with no build step; nothing forces `index.html` into JS. Only
  `run_worker_first: true` (blanket), SPA mode, or wanting HTMLRewriter injection would.
- Pages' free 404 is not inherited — `public/404.html` is new and must be hand-written.
- `/index.html` 307-redirects to `/` under default `html_handling`.

### Cross-ticket note, already settled

T2 flagged that "no zone-level purge affects Workers Caching content" might undermine the dashboard
refresh lever. **T1 resolved this**: that sentence describes the newer opt-in Workers Cache
(`ctx.cache`), not the classic Cache API (`caches.default`) this design uses. No conflict.
