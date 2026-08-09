<!-- label: wayfinder:research -->

# T2 — Workers Static Assets alongside one dynamic route

Researched 2026-08-09 against `developers.cloudflare.com` (pages dated "Last updated Apr 23, 2026")
and, where the docs are ambiguous, against the implementation in `cloudflare/workers-sdk`
(`packages/workers-shared/{router-worker,asset-worker}`), which is the code that actually makes the
asset-vs-Worker routing decision.

---

## RECOMMENDATION

Yes — the split works, cleanly, and `index.html` stays a plain hand-edited file. But **only one
configuration gets both a static 404 page and a Worker-rendered `/bookshelf`.** The obvious config
(`not_found_handling: "404-page"` alone) silently breaks `/bookshelf` for browsers. See "The trap"
below.

### Recommended `wrangler.jsonc`

```jsonc
{
  "$schema": "./node_modules/wrangler/config-schema.json",
  "name": "augustskare-no",
  "main": "./src/index.ts",
  "compatibility_date": "2026-08-09",
  "assets": {
    "directory": "./public",
    "binding": "ASSETS",
    "not_found_handling": "404-page",
    "run_worker_first": ["/bookshelf", "/bookshelf/*"],
  },
}
```

with a directory layout of:

```
public/
  index.html      hand-written, untouched
  style.css       shared stylesheet
  hubot.woff2
  404.html        hand-written (new — replaces Pages' free 404)
  _headers        optional; long cache for the font, see Q3
src/
  index.ts        the Worker; renders /bookshelf
```

### Resulting request routing (exact)

| Request                                 | Who serves it                                     | Worker invoked? | Billable? |
| --------------------------------------- | ------------------------------------------------- | --------------- | --------- |
| `GET /`                                 | `public/index.html`, 200                          | no              | no        |
| `GET /index.html`                       | 307 redirect to `/` (`html_handling` default)     | no              | no        |
| `GET /style.css`, `GET /hubot.woff2`    | asset, 200                                        | no              | no        |
| `GET /bookshelf` (any `Sec-Fetch-Mode`) | **Worker**                                        | yes             | yes       |
| `POST /bookshelf`                       | **Worker** (static routing matches pathname only) | yes             | yes       |
| `GET /anything-else`                    | `public/404.html`, 404                            | no              | no        |
| `GET /nested/anything`                  | nearest `404.html` walking up, then root, 404     | no              | no        |

Net effect: the Worker runs for `/bookshelf` and nothing else. Every other request is a free,
unmetered static-asset request. On the Free plan that means the 100k/day request budget is consumed
only by `/bookshelf`.

### The trap (why `run_worker_first` is not optional here)

Since compatibility date `2025-04-01`, the flag `assets_navigation_prefers_asset_serving` is on by
default. When it is on **and** `not_found_handling` is set to something other than `none`, a
_navigation_ request (what a browser sends when you type a URL — `Sec-Fetch-Mode: navigate`) that
matches no asset is answered by the **asset** fallback and the Worker is never invoked.

So `not_found_handling: "404-page"` _without_ `run_worker_first` would serve `404.html` to anyone
who navigates to `/bookshelf` in a browser, while `fetch("/bookshelf")` from JS would correctly hit
the Worker. Listing `/bookshelf` in `run_worker_first` routes it to the Worker before any of that
logic runs.

### Minimal alternative (if a custom 404 page is not wanted)

```jsonc
{
  "name": "augustskare-no",
  "main": "./src/index.ts",
  "compatibility_date": "2026-08-09",
  "assets": { "directory": "./public", "binding": "ASSETS" },
}
```

`not_found_handling` defaults to `"none"`, which means the asset layer has no fallback to prefer, so
the navigation-preference behaviour is inert and **every** unmatched path — `/bookshelf` and
`/typo` alike — reaches the Worker. The Worker then owns the 404 (`return new Response("Not found",
{ status: 404 })`). Simpler config, but every 404-seeking bot request becomes a billable Worker
invocation, and the 404 body has to live in TypeScript rather than in a hand-written HTML file.

---

## Evidence

### Q1 — Config keys and their semantics

Wrangler configuration reference, <https://developers.cloudflare.com/workers/wrangler/configuration/#assets>:

- `directory` — "Folder of static assets to be served." "For many frameworks, this is the
  `./public/`, `./dist/`, or `./build/` folder." Path is relative to the Wrangler config file.
- `binding` — "The binding name used to refer to the assets." Optional; only needed if Worker code
  wants to fetch assets itself.
- `html_handling` — `"auto-trailing-slash"` (default), `"force-trailing-slash"`,
  `"drop-trailing-slash"`, `"none"`.
- `not_found_handling` — `"single-page-application"`, `"404-page"`, or `"none"` (**default**).
- `run_worker_first` — "Controls whether static assets are fetched directly, or a Worker script is
  invoked." Boolean or array of route patterns; defaults to `false`.

Defaults confirmed in source — `packages/workers-shared/asset-worker/src/configuration.ts`:

```ts
html_handling: configuration?.html_handling ?? "auto-trailing-slash",
not_found_handling: configuration?.not_found_handling ?? "none",
```

`run_worker_first` — <https://developers.cloudflare.com/workers/static-assets/routing/worker-script/>:

> "If you need to always run your Worker script before serving static assets (for example, you wish
> to log requests, perform some authentication checks, use HTMLRewriter, or otherwise transform
> assets before serving), set `run_worker_first` to `true`"

> "You can also configure selective Worker-first routing using an array of route patterns… This
> allows you to run the Worker first only for specific routes while letting other requests follow
> the default asset-first behavior"

Binding page, <https://developers.cloudflare.com/workers/static-assets/binding/#run_worker_first>:
`false` (default) serves matching assets directly; `true` "unconditionally invokes the Worker
script"; arrays support `*` globs and `!`-prefixed negative patterns, and "Negative patterns have
precedence over non-negative patterns."

**Pattern matching is glob-only and fully anchored.** From
`packages/workers-shared/asset-worker/src/utils/rules-engine.ts`:

```ts
export const generateGlobOnlyRuleRegExp = (rule: string) => {
  rule = rule.split("*").map(escapeRegex).join(".*");
  rule = "^" + rule + "$";
  return RegExp(rule);
};
```

and `generateStaticRoutingRuleMatcher` tests it against `new URL(request.url).pathname` only. So
`"/bookshelf"` matches `/bookshelf` and _not_ `/bookshelf/` — hence the recommendation lists both
`"/bookshelf"` and `"/bookshelf/*"`. No method or header is considered.

Real fixture in the SDK confirming the array form
(`fixtures/workers-with-assets-static-routing/wrangler.jsonc`):

```jsonc
"run_worker_first": [
	"/worker/*",
	"/oauth/callback",
	"!/missing-asset",
	"!/worker/asset",
]
```

Binding usage — <https://developers.cloudflare.com/workers/static-assets/binding/>:

> "The assets binding allows you to dynamically fetch assets from within your Worker script (e.g.
> `env.ASSETS.fetch()`), similarly to how you might with a make a `fetch()` call with a Service
> binding."
> "Requests made through this method have `html_handling` and `not_found_handling` configuration
> applied to them."
> "Only the URL pathname is used to match assets" — the hostname is irrelevant.

`.assetsignore` (same page): a `.gitignore`-format file in the assets directory root; "Wrangler will
not upload asset files that match lines in this file." Useful for suppressing leftovers when
migrating off Pages (`_worker.js`, `_redirects`).

### Q2 — Which requests invoke the Worker; does `/bookshelf` reach it?

The plain-language rule, <https://developers.cloudflare.com/workers/static-assets/routing/worker-script/>:

> "If you have both static assets and a Worker script configured, Cloudflare will first attempt to
> serve static assets if one matches the incoming request. … If an appropriate static asset if not
> found, Cloudflare will invoke your Worker script."

And <https://developers.cloudflare.com/workers/static-assets/>:

> "if a requested URL matches a file in the static assets directory, that file will be served —
> without invoking Worker code."

The qualification that matters, compatibility flags page,
<https://developers.cloudflare.com/workers/configuration/compatibility-flags/#navigation-requests-prefer-asset-serving>
(Default as of **2025-04-01**; enable `assets_navigation_prefers_asset_serving`, disable
`assets_navigation_has_no_effect`):

> "For Workers with static assets and this compatibility flag enabled, navigation requests (requests
> which have a `Sec-Fetch-Mode: navigate` header) will prefer to be served by our asset-serving
> logic, even when an exact asset match cannot be found. This is particularly useful for
> applications which operate in either Single Page Application (SPA) mode or have custom 404 pages,
> as this now means the fallback pages of `200 /index.html` and `404 /404.html` will be served ahead
> of invoking a Worker script and will therefore avoid incurring a charge."
>
> "Without this flag, the runtime will continue to apply the old behavior of invoking a Worker
> script (if present) for any requests which do not exactly match a static asset."
>
> "When `assets.run_worker_first = true` is set, this compatibility flag has no effect."

SSG routing page,
<https://developers.cloudflare.com/workers/static-assets/routing/static-site-generation/#navigation-requests>:

> "If you have a Worker script (`main`), **have configured `assets.not_found_handling`**, and use
> the assets_navigation_prefers_asset_serving compatibility flag (or set a compatibility date of
> `2025-04-01` or greater), _navigation requests_ will not invoke the Worker script."

> "This can lead to surprising but intentional behavior. For example, if you define an API endpoint
> in a Worker script (e.g. `/api/date`) and then fetch it with a client-side request in your SPA
> (e.g. `fetch("/api/date")`), the Worker script will be invoked and your API response will be
> returned as expected. However, if you navigate to `/api/date` in your browser, you will be served
> an HTML file."

**`/bookshelf` is exactly the `/api/date` case.** The docs' emphasis on "have configured
`assets.not_found_handling`" is load-bearing, and the source confirms it precisely. The router
(`packages/workers-shared/router-worker/src/worker.ts`) asks the asset worker whether it _could_
serve the request, and dispatches to the user Worker if not:

```ts
const assetsExist = await this.env.ASSET_WORKER.unstable_canFetch(...);
if (config.has_user_worker && !assetsExist) {
	return await routeToUserWorker({ asset: "none" });
}
return await routeToAssets({ asset: assetsExist ? "found" : "none" });
```

and `canFetch` (`packages/workers-shared/asset-worker/src/handler.ts`) is where the navigation rule
lives:

```ts
const shouldKeepNotFoundHandling =
  configuration.has_static_routing ||
  (flagIsEnabled(configuration, SEC_FETCH_MODE_NAVIGATE_HEADER_PREFERS_ASSET_SERVING) &&
    request.headers.get("Sec-Fetch-Mode") === "navigate");
if (!shouldKeepNotFoundHandling) {
  configuration = { ...configuration, not_found_handling: "none" };
}
```

Reading that against `notFound()` in the same file (`case "none": default: return null;`) gives the
complete decision table for a path with no matching asset:

| `not_found_handling`      | `run_worker_first`         | navigation request                        | non-navigation request |
| ------------------------- | -------------------------- | ----------------------------------------- | ---------------------- |
| `none` (default)          | unset                      | **Worker**                                | **Worker**             |
| `404-page`                | unset                      | `404.html`, Worker never runs             | **Worker**             |
| `single-page-application` | unset                      | `index.html` 200, Worker never runs       | **Worker**             |
| `404-page`                | array incl. the path       | **Worker**                                | **Worker**             |
| `404-page`                | array _not_ incl. the path | `404.html`                                | `404.html` (¹)         |
| any                       | `true`                     | **Worker** (assets only via `env.ASSETS`) | **Worker**             |

¹ Note the asymmetry: setting `run_worker_first` as an array sets `has_static_routing`, which makes
`shouldKeepNotFoundHandling` true for _all_ requests, not just navigations. Confirmed in
`packages/miniflare/src/plugins/assets/index.ts`:
`has_static_routing: Boolean(options.assets.routerConfig?.static_routing)`. This is why the
recommended config never invokes the Worker outside `/bookshelf`.

`run_worker_first: true` (boolean) short-circuits everything — router worker:

```ts
// User's configuration indicates they want user-Worker to run ahead of any
// assets. Do not provide any fallback logic.
if (config.invoke_user_worker_ahead_of_assets) {
  return await routeToUserWorker({ asset: "static_routing" });
}
```

That would make every request to `/` billable and force `index.html` to be served through
`env.ASSETS.fetch()`. Do not use it here.

Official routing flowchart (rendered on both the SPA and SSG pages) matches the above:
`Incoming request → run_worker_first? → request matches asset? → Worker script present? → request is
navigation request? → [Yes] asset serving / [No] Worker script invoked`, with the note:

> "Requests are only billable if a Worker script is invoked. From there, it is possible to serve
> assets using the assets binding."

Asset matching itself (`html_handling: "auto-trailing-slash"`, the default),
<https://developers.cloudflare.com/workers/static-assets/routing/advanced/html-handling/>:

| Incoming request | Response          | Asset served              |
| ---------------- | ----------------- | ------------------------- |
| `/file`          | 200               | `/dist/file.html`         |
| `/file.html`     | 307 to `/file`    | —                         |
| `/file/`         | 307 to `/file`    | —                         |
| `/folder`        | 307 to `/folder/` | —                         |
| `/folder/`       | 200               | `/dist/folder/index.html` |

So `/` serves `public/index.html`, and a stale link to `/index.html` 307-redirects to `/`.

### Q3 — Caching

**How assets are cached.** <https://developers.cloudflare.com/workers/static-assets/#caching>:

> "Cloudflare provides automatic caching for static assets across its network, ensuring fast delivery
> to users worldwide."

Assets are content-addressed by ETag and read out of an internal KV namespace behind Cloudflare's
tiered cache; the response carries `CF-Cache-Status: HIT|MISS`. There is no user-facing TTL knob for
that internal layer — it is not a zone cache rule and it is not configurable from `wrangler.jsonc`.
Because the cache key is the asset's content hash, deploying changed files takes effect immediately.

**Default response headers**, <https://developers.cloudflare.com/workers/static-assets/headers/>:

- `Content-Type` (from file extension at upload time)
- `ETag` — "Its value is a hash of the static asset file"
- `CF-Cache-Status` — `HIT` or `MISS`; docs warn it is "probabilistic"
- `Cache-Control` — sent "when the request does not have an `Authorization` or `Range` header",
  "telling the browser that the asset can be cached, but the browser should revalidate the freshness
  of the content every time before using it"

The exact value, from `packages/workers-shared/asset-worker/src/constants.ts`:

```ts
// have the browser check in with the server to make sure its local cache is valid before using it
export const CACHE_CONTROL_BROWSER = "public, max-age=0, must-revalidate";
```

Note the constant's name: this header is aimed at the **browser**. It does not configure Cloudflare's
own asset cache.

**Controlling it.** A plain-text `_headers` file (no extension) in the assets directory overrides,
adds to, or removes response headers. Limits: 100 rules, 2,000 characters per line. For `hubot.woff2`
and `style.css` the documented aggressive pattern is:

```
/hubot.woff2
  Cache-Control: public, max-age=31556952, immutable
```

Caveat, quoted from the same page and directly relevant to T1/T7:

> "Custom headers defined in the `_headers` file are not applied to responses generated by your
> Worker code."

**Is it a different cache layer from a Worker response's?** Yes, and they do not interact.

- Static assets: Cloudflare's internal, automatic asset cache. Not configurable, not addressable.
- Worker responses: whatever T1 picks. If T1 picks **Workers Cache** (`cache.enabled` in
  `wrangler.jsonc` + `Cache-Control` on the response), <https://developers.cloudflare.com/workers/cache/>
  is explicit that it is "**your Worker's cache** — configured through your Worker's code and
  Wrangler file", that "Zone configuration has no effect" (Cache Rules, Page Rules, default cached
  file extensions all do not apply), and per
  <https://developers.cloudflare.com/workers/cache/purge/>: "no zone-level purge (via the dashboard,
  API, or Terraform) affects Workers Caching content." It also partitions the cache by Worker
  version by default, so a deploy starts cold.

That last point is a live contradiction with the map's standing preference ("Cloudflare dashboard
'Purge Everything' is the refresh lever"). Flagged for T1/T7 below, not resolved here.

### Q4 — 404 handling

`not_found_handling` values, from
<https://developers.cloudflare.com/workers/wrangler/configuration/#assets> and the routing pages:

- **`"none"` (default)** — no fallback. The asset layer reports "no intent", and the request falls
  through to the Worker if one exists. If no Worker exists, a bare 404 is returned.
- **`"404-page"`** — <https://developers.cloudflare.com/workers/static-assets/routing/static-site-generation/#custom-404-pages>:
  "When an incoming request does not match a file in the `assets.directory`, Workers will serve the
  contents of the nearest `404.html` file with a `404 Not Found` status." "Nearest" means walking up
  the path: for `/a/b/c` it tries `/a/b/404.html`, then `/a/404.html`, then `/404.html`, then serves
  a null-body 404 (`notFound()` in `handler.ts`; the flowchart labels the last case "**404 Not
  Found** null-body response served").
- **`"single-page-application"`** — serves `/index.html` with `200 OK` for unmatched requests. Wrong
  for this site: it would answer every typo'd URL with the CV page under a 200.

For this site: `"404-page"` + a hand-written `public/404.html` is the closest replacement for what
Pages gave for free, and it costs nothing (asset requests are free). It only works alongside
`/bookshelf` because `run_worker_first` static-routes that one path — see Q2.

### Q5 — `wrangler dev`

Yes, it replaces `http-server site`.

<https://developers.cloudflare.com/workers/wrangler/commands/#dev> — "Start a local server for
developing your Worker"; requests go to `localhost:8787` by default (`--port`, `--ip` available).
There is also an `--assets` flag ("Folder of static assets to be served. Replaces Workers Sites"),
though with `assets.directory` in `wrangler.jsonc` it is unnecessary.

<https://developers.cloudflare.com/workers/static-assets/get-started/> for the full-stack template:
"Run `npx wrangler dev` locally. Edit `src/index.ts` for server-side behavior and
`public/index.html` for static assets. Changes appear after saving and reloading."

Fidelity is high because local dev is not a re-implementation: Miniflare runs the _same_
`router.worker.ts` / `assets.worker.ts` sources from `packages/workers-shared`
(`packages/miniflare/src/workers/assets/`), including `has_static_routing`, `not_found_handling`,
`html_handling` and the `Sec-Fetch-Mode: navigate` rule. Wrangler also watches the assets directory
during `wrangler dev` (`packages/wrangler/src/__tests__/api/startDevWorker/BundlerController.assets-watcher.test.ts`).

Practical consequence for T6: replace `"dev": "http-server site"` with `"dev": "wrangler dev"`, and
`/bookshelf` becomes testable locally against the same routing rules as production.

### Q6 — Anything forcing `index.html` to stop being a plain file?

**No.** Nothing found in the docs or the source requires it.

- Assets are uploaded byte-for-byte by Wrangler; there is no build, transform, or templating step.
  `directory` is just "Folder of static assets to be served."
- Limits are irrelevant at this scale: 20,000 files per Worker version on Free (100,000 on Paid),
  25 MiB per file (<https://developers.cloudflare.com/workers/platform/limits/#static-assets>).
- With the recommended config the Worker never sees `/`, so `index.html` is never even read by Worker
  code.

Three things that _would_ pull it out of being plain, all avoidable:

1. `run_worker_first: true` (boolean). Every request, including `/`, goes through Worker code, which
   must then call `env.ASSETS.fetch(request)`. The file stays a file, but `/` becomes billable and
   the Worker becomes load-bearing for the homepage. Not needed.
2. Wanting the Worker to _inject_ anything into the homepage (e.g. a nav link to `/bookshelf`,
   explicitly out of scope in the map). The supported mechanism is `run_worker_first` +
   `HTMLRewriter` over the asset response — again not templating, but it does put Worker code on the
   `/` path.
3. `not_found_handling: "single-page-application"`, which would make `index.html` the fallback body
   for every unmatched URL. Not wanted here.

The one behavioural change to be aware of: with the default `html_handling: "auto-trailing-slash"`,
`/index.html` 307-redirects to `/`. Any hard-coded `index.html` link in the CV or in external
references picks up a redirect hop.

### Plan gating (Free plan assumed)

<https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/>:

> "Requests to static assets are free and unlimited."
> "There is no additional cost for storing Assets."

Worker invocations bill as normal Workers requests (Free: 100,000/day). The one Free-plan trap, from
the same page:

> "If you exceed your free tier request limits, these requests will receive a 429 (Too Many Requests)
> response instead of falling back to static asset serving."

This applies to `run_worker_first` matches — i.e. in the recommended config, only `/bookshelf` would
429 after the daily limit; `/`, the CSS and the font keep serving. Confirmed in the router worker,
which returns a rendered 429 page when `eyeballConfig.limitedAssetsOnly` is set. Static assets
themselves are never rate-limited.

File-count limits differ by plan (20,000 Free / 100,000 Paid) and need Wrangler ≥ 4.34.0 for the
higher figure. Neither binds here.

---

## Unresolved / low confidence

- **The map's "Purge Everything" refresh lever may not exist for the mechanism T1 picks.**
  <https://developers.cloudflare.com/workers/cache/purge/> states plainly that "no zone-level purge
  (via the dashboard, API, or Terraform) affects Workers Caching content", and Workers Cache is
  partitioned by Worker version so a redeploy — not a purge — is what invalidates it. If T1 instead
  uses the older zone-scoped Cache API (`caches.default`) on a custom domain, dashboard purge _does_
  apply. This decides whether "manual refresh, permanently" means "click Purge Everything" or
  "redeploy the Worker". **T1/T7 must settle which cache is in play; T2 did not.**
- **Whether the Free plan can enable Workers Cache (`cache.enabled`) at all.** The configuration and
  limitations pages do not state plan gating; the limitations page only says "At launch, all Workers
  Caching responses are subject to the Free plan size limit regardless of your account's plan."
  Requires Wrangler ≥ 4.69.0. Not verified against an actual Free account.
- **Exact `run_worker_first` pattern needed for `/bookshelf`.** Confirmed from source that patterns
  are anchored globs over the pathname, so `"/bookshelf"` alone does not cover `/bookshelf/`. The
  recommendation adds `"/bookshelf/*"` defensively; this was reasoned from the regex construction,
  not observed in a running deployment. Worth a single curl after cutover.
- **Whether `_headers` and `_redirects` rules are applied before or after static routing.** The
  asset worker applies them inside its own request handling, so a path routed to the Worker by
  `run_worker_first` never sees them. Not explicitly documented; inferred from `handleRedirects` /
  `attachCustomHeaders` living in `asset-worker/src/handler.ts`.
- **Cloudflare's internal asset cache TTL and whether `_headers`' `Cache-Control` influences it or
  only the browser.** The source constant is named `CACHE_CONTROL_BROWSER` and the docs describe the
  header in browser terms, but no doc states whether a `_headers`-supplied `s-maxage` reaches
  Cloudflare's own asset cache. Low stakes here (assets change only on deploy, and the ETag changes
  with them).

## Pages read

All fetched 2026-08-09.

- <https://developers.cloudflare.com/workers/static-assets/>
- <https://developers.cloudflare.com/workers/static-assets/binding/>
- <https://developers.cloudflare.com/workers/static-assets/headers/>
- <https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/>
- <https://developers.cloudflare.com/workers/static-assets/get-started/>
- <https://developers.cloudflare.com/workers/static-assets/routing/>
- <https://developers.cloudflare.com/workers/static-assets/routing/worker-script/>
- <https://developers.cloudflare.com/workers/static-assets/routing/static-site-generation/>
- <https://developers.cloudflare.com/workers/static-assets/routing/single-page-application/>
- <https://developers.cloudflare.com/workers/static-assets/routing/advanced/html-handling/>
- <https://developers.cloudflare.com/workers/static-assets/routing/advanced/serving-a-subdirectory/>
- <https://developers.cloudflare.com/workers/configuration/compatibility-flags/#navigation-requests-prefer-asset-serving>
- <https://developers.cloudflare.com/workers/wrangler/configuration/#assets>
- <https://developers.cloudflare.com/workers/wrangler/commands/#dev>
- <https://developers.cloudflare.com/workers/platform/limits/#static-assets>
- <https://developers.cloudflare.com/workers/cache/>, `/configuration/`, `/purge/`, `/limitations/`
- <https://developers.cloudflare.com/workers/reference/how-the-cache-works/>

Source read in `cloudflare/workers-sdk` @ `main`:

- `packages/workers-shared/router-worker/src/worker.ts`
- `packages/workers-shared/asset-worker/src/handler.ts` (`canFetch`, `getIntent`, `notFound`)
- `packages/workers-shared/asset-worker/src/configuration.ts`
- `packages/workers-shared/asset-worker/src/compatibility-flags.ts`
- `packages/workers-shared/asset-worker/src/constants.ts`
- `packages/workers-shared/asset-worker/src/utils/headers.ts`
- `packages/workers-shared/asset-worker/src/utils/rules-engine.ts`
- `packages/workers-shared/utils/types.ts`
- `packages/miniflare/src/plugins/assets/index.ts`
- `fixtures/workers-with-assets-static-routing/wrangler.jsonc`
