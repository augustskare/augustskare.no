# T1 — Which cache layer holds Worker HTML, and does dashboard Purge Everything clear it?

Researched 2026-08-09 against `developers.cloudflare.com` primary docs. Every page cited was
fetched as raw Markdown (`<url>/index.md`) so the quotes below are verbatim, not paraphrase.
Doc `dateModified` is recorded per source at the bottom.

---

## RECOMMENDATION

**Use exactly one layer: the classic Cache API, `caches.default`, with an explicit
`cache.put()` from inside the Worker.**

It is the only layer that satisfies all three constraints at once — it holds a
Worker-_generated_ response, it needs no storage product, and Cloudflare's docs state
plainly that dashboard **Purge Everything** clears it globally.

**Do NOT** enable the newer Workers Cache (`[cache] enabled = true` / `ctx.cache`). It is a
better cache in every technical respect (read-through, tiered, request-collapsing) but it is
explicitly **immune to zone-level purge**, which kills the one refresh lever this design has.

### The shape

```ts
export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const cache = caches.default;
    const hit = await cache.match(request);
    if (hit) return hit;

    const html = await renderBookshelf(); // fetch PDS + template
    const response = new Response(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        // s-maxage = edge TTL (1 year). max-age = browser TTL (short, so a
        // dashboard purge is visible to returning visitors within a minute).
        "Cache-Control": "public, max-age=60, s-maxage=31536000",
        "Cache-Tag": "bookshelf",
      },
    });

    ctx.waitUntil(cache.put(request, response.clone()));
    return response;
  },
};
```

### Exact headers to set

| Header          | Value                                   | Why                                                                                                                                                |
| --------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Cache-Control` | `public, max-age=60, s-maxage=31536000` | `s-maxage` is the edge TTL, `max-age` the browser TTL. Cache API respects `Cache-Control` on the response passed to `put()`.                       |
| `Cache-Tag`     | `bookshelf`                             | Free — gives a second, narrower dashboard purge lever, and tag purge is one of only two purge methods the docs confirm works on Cache API entries. |
| `Content-Type`  | `text/html; charset=utf-8`              | —                                                                                                                                                  |

Do **not** set `Set-Cookie` (never cached), do not send `Vary: *` (`cache.put` throws), and do
not use a custom cache key (breaks single-URL purge).

### Dashboard Cache Rule needed

**None.** A Cache Rule would not help and cannot help — see Q1 below. Zone cache configuration
is irrelevant in both directions here: it cannot make a Worker response cacheable, and Workers
Cache ignores it entirely.

### Wrangler config needed

**None for caching.** Specifically, leave `[cache] enabled` unset/false.

### Plan gating

Nothing in this recommendation is plan-gated. Cache API works on Workers Free (512 MB max
object, 50 calls/request). Purge Everything is available on Free. Details in Q4.

---

## Q1 — Do Worker-generated responses reach the zone CDN cache from `Cache-Control` alone?

**No. Not from headers, and not via a Cache Rule.** A response your Worker synthesises and
returns is handed straight to the eyeball; the zone cache is behind the Worker, not in front
of it, and the caching decision has already been made by the time your code runs.

> Cloudflare Workers run before the cache but can also be utilized to modify assets once they
> are returned from the cache.
> — https://developers.cloudflare.com/workers/reference/how-the-cache-works/

> Workers and [Response Header Transform Rules] execute after the caching decision has been
> made and cannot influence whether or how a response is cached. Only Cache Response Rules can
> modify caching behavior based on origin response headers.
> — https://developers.cloudflare.com/cache/how-to/cache-response-rules/

That second quote is about the zone pipeline's decision for an _origin_ response, and it is
the reason a Cache Rule is no help either: a Cache Rule acts on the request as it travels to
an origin, and when a Worker is involved it matches the Worker's `fetch()` subrequest, not the
visitor's URL:

> When using cache rules with Workers, the cache rule must match the properties of the URL in
> the `fetch()` (b) request — such as headers, hostname, or URL path — not the original visitor
> URL/host (a). Otherwise, the rule will not be applied.
> — https://developers.cloudflare.com/cache/interaction-cloudflare-products/workers/

There is no origin here — the HTML is rendered in the Worker — so there is no subrequest for a
Cache Rule to match, and nothing to cache at the zone layer.

Cloudflare states the two supported ways to cache a Worker's own output, and both are explicit
opt-ins, not header side-effects:

> Store responses using the Cache API from a Workers script. This allows caching responses that
> did not come from an origin […] Caching responses generated by the Worker itself through
> `cache.put()`.
> — https://developers.cloudflare.com/workers/reference/how-the-cache-works/

> To cache responses from a Worker itself — so that Cloudflare returns the cached response
> without executing the Worker — refer to Cache [/workers/cache/].
> — https://developers.cloudflare.com/workers/reference/how-the-cache-works/ (page note)

And on the Cache API page, describing the newer product:

> To cache responses from your Worker so that Cloudflare returns them without executing your
> Worker, use Workers Caching instead. The two mechanisms are independent.
> — https://developers.cloudflare.com/workers/runtime-apis/cache/

**Answer: an explicit `caches.default.put()` is required** (or, alternatively, opting into
Workers Cache — rejected here for purge reasons). A `Cache-Control` header on its own does
nothing.

---

## Q2 — What does dashboard Purge Everything clear?

### Zone CDN cache — YES

> Purging everything instantly clears all resources from your CDN cache in all Cloudflare data
> centers.
> — https://developers.cloudflare.com/cache/how-to/purge-cache/purge-everything/

### Classic Cache API (`caches.default`) — YES

This is the decisive quote for the whole design:

> Assets stored in the cache through Cache API operations can be purged in a couple of ways:
> […] To purge an asset globally, use the standard cache purge options. Based on cache API
> implementation, not all cache purge endpoints function for purging assets stored by the Cache
> API.
>
> - **All assets on a zone can be purged by using the Purge Everything cache operation. This
>   purge will remove all assets associated with a Cloudflare zone from cache in all data
>   centers regardless of the method set.**
> - Cache Tags can be added to requests dynamically in a Worker by calling
>   `response.headers.append()` and appending `Cache-Tag` values dynamically to that request.
>   Once set, those tags can be used to selectively purge assets from cache without invalidating
>   all cached assets on a zone.
>   — https://developers.cloudflare.com/workers/reference/how-the-cache-works/#purge-assets-stored-with-the-cache-api

Note the hedge in the middle — "not all cache purge endpoints function" for Cache API entries.
Purge Everything and purge-by-tag are the two the docs affirm. Purge-by-URL is conspicuously
_not_ affirmed for Cache API entries.

### Workers Cache (`ctx.cache` / `import { cache } from "cloudflare:workers"`) — NO

> A Worker cannot reach into another Worker's cache, an entrypoint cannot reach into another
> entrypoint's cache, and **no zone-level purge (via the dashboard, API, or Terraform) affects
> Workers Caching content**.
> — https://developers.cloudflare.com/workers/cache/purge/

> **No zone configuration for caching applies to Workers Caching.** Cache Rules, Cache Response
> Rules, Page Rules, cache level settings, the zone's default cached-file-extensions list, and
> every other zone-level cache control have no effect on a Worker's cache.
> — https://developers.cloudflare.com/workers/cache/

### The contradiction — RESOLVED

**The hypothesis in the ticket is correct and is confirmed by Cloudflare's own text.** These
are two separate products, and the three statements apply to two different things:

|                            | Cache API (`caches.default`)        | Workers Cache (`ctx.cache`)                                      |
| -------------------------- | ----------------------------------- | ---------------------------------------------------------------- |
| Age                        | Long-standing                       | Newer; docs `dateModified` Jul 2026, "Coming soon: Dashboard UI" |
| Enabled by                 | Nothing — always available          | Opt-in `[cache] enabled = true` in Wrangler config               |
| Populated by               | Explicit `cache.put()` in your code | Automatically, from `Cache-Control` on the returned response     |
| Worker runs on a hit?      | Yes, every request                  | No                                                               |
| Scope                      | The zone / the URL                  | The Worker + entrypoint + `ctx.props` (zoneless)                 |
| Dashboard Purge Everything | **Clears it**                       | **Does not touch it**                                            |
| Its own purge              | `cache.delete()` (local only)       | `ctx.cache.purge({ purgeEverything: true })`                     |

Cloudflare says this outright:

> The Cache API is a separate programmatic cache store. It is independent of Workers Caching —
> operations on one do not affect the other, and `ctx.cache.purge()` is what invalidates
> Workers-Caching entries.
> — https://developers.cloudflare.com/workers/cache/limitations/

The docs also now carry explicit disambiguation notes on both older pages, added to point
readers at the new product:

> This page describes how Workers interact with a **zone's** Cloudflare Cache — for example,
> when a Worker runs on a zone with Cache Rules configured, or when a Worker uses the Cache API
> or `fetch()` to store and retrieve responses.
> — https://developers.cloudflare.com/workers/reference/how-the-cache-works/ (page note)

So `how-the-cache-works` ("Purge Everything works") is about the Cache API, and `workers/cache/purge`
("zone purge does not affect this") is about Workers Cache. **Neither page is wrong.**

---

## Q3 — Is `caches.default` the same store as the zone CDN cache?

**Effectively yes for purge purposes; not identical in behaviour.** The docs are genuinely
loose here, and the "differs from Cloudflare's Global CDN" line is about _replication_, not
about being a separate store.

> **`caches.default`** – You can access the default cache (the same cache shared with `fetch`
> requests) by accessing `caches.default`.
> — https://developers.cloudflare.com/workers/reference/how-the-cache-works/

> This individualized zone cache object differs from Cloudflare's Global CDN.
> — https://developers.cloudflare.com/workers/runtime-apis/cache/

The meaning of "differs" is spelled out immediately above it on the same page:

> The Cache API is available globally but the contents of the cache do not replicate outside of
> the originating data center. A `GET /users` response can be cached in the originating data
> center, but will not exist in another data center unless it has been explicitly created.
> — https://developers.cloudflare.com/workers/runtime-apis/cache/

> Cache API is local to a data center, this means that `cache.match` does a lookup, `cache.put`
> stores a response, and `cache.delete` removes a stored response only in the cache of the data
> center that the Worker handling the request is in.
> — https://developers.cloudflare.com/workers/reference/how-the-cache-works/

**Reading:** it is the same physical zone cache infrastructure (hence "the same cache shared
with `fetch` requests", hence Purge Everything reaching it), but writes are not fanned out
across data centers and it does not participate in Tiered Cache. The word "zone" in
"individualized **zone** cache object" is itself evidence that entries are zone-scoped and
therefore in scope for a zone purge.

**Practical consequence for /bookshelf:** the page is rendered once _per Cloudflare data
center that receives traffic_, not once globally. For a personal site that is a handful of
cold renders, spread out. That is a cost/latency footnote, not a correctness problem — a cold
data center just re-renders from the PDS.

---

## Q4 — Recommended pattern for "render once, serve indefinitely, purge by hand", Free plan

The pattern is the one in the RECOMMENDATION block: `cache.match()` → render on miss →
`ctx.waitUntil(cache.put(request, response.clone()))`. Cloudflare names this as the intended
use of the Cache API for exactly this situation:

> For projects where there is no backend (that is, the entire project is on Workers […]) the
> Cache API is the only option to customize caching.
> — https://developers.cloudflare.com/workers/reference/how-the-cache-works/

The Worker must be on a custom domain, which it is:

> Workers deployed to custom domains have access to functional `cache` operations. So do Pages
> functions […] However, any Cache API operations in the Cloudflare Workers dashboard editor and
> Playground previews will have no impact.
> — https://developers.cloudflare.com/workers/runtime-apis/cache/

**That last sentence matters for the runbook:** you cannot test this from the dashboard editor
or the Playground. Verify with `curl` against the real deployed custom domain.

### TTL semantics

> You can also simultaneously specify a Cloudflare Edge Cache TTL different than a Browser's
> Cache TTL respectively via the `s-maxage` and `max-age` `Cache-Control` headers.
> — https://developers.cloudflare.com/cache/concepts/cache-control/

> `s-maxage=seconds` — Indicates that in shared caches, the maximum age specified by this
> directive overrides the maximum age specified by either the `max-age` directive or the
> `Expires` header field. […] Browsers ignore `s-maxage`.
> — https://developers.cloudflare.com/cache/concepts/cache-control/

The Cache API honours it on `put()`:

> Our implementation of the Cache API respects the following HTTP headers on the response passed
> to `put()`: `Cache-Control` […] `Cache-Tag` […] `ETag` […] `Expires` […] `Last-Modified`
> — https://developers.cloudflare.com/workers/runtime-apis/cache/

Keep `max-age` short (60s) deliberately. If you send a year-long browser TTL, Purge Everything
clears the edge but returning visitors keep their own stale copy and the button appears not to
have worked.

### Free-plan limits (all comfortably satisfied)

| Limit                       | Free                                               | Relevance                           |
| --------------------------- | -------------------------------------------------- | ----------------------------------- |
| Cache API max object size   | 512 MB                                             | An HTML list of 58 books is ~10 KB. |
| Cache API calls per request | 50 (shares the `fetch()` subrequest quota)         | We use 2.                           |
| Cacheable file size         | 512 MB (Free/Pro/Business)                         | —                                   |
| Purge availability          | **Yes** on Free                                    | —                                   |
| Purge options on Free       | "URL, Hostname, Tag, Prefix, and Purge Everything" | —                                   |
| Purge rate limit            | 5 requests/minute, bucket 25, per account          | A human clicking a button.          |

Sources: https://developers.cloudflare.com/workers/platform/limits/#cache-api-limits ,
https://developers.cloudflare.com/cache/concepts/default-cache-behavior/#cacheable-size-limits ,
https://developers.cloudflare.com/cache/how-to/purge-cache/#availability-and-limits

After a purge:

> Purge Everything invalidates the resource, resulting in the `CF-Cache-Status` header
> indicating EXPIRED for subsequent requests.
> — https://developers.cloudflare.com/cache/how-to/purge-cache/purge-everything/

The dashboard path, for T8: **Caching → Configuration → Purge Cache → Purge Everything**
(`https://dash.cloudflare.com/?to=/:account/:zone/caching/configuration`).

### Why not Workers Cache, stated for the record

Technically it is the better product for this workload — read-through so the Worker does not
run on a hit, tiered so the first render on Earth serves every data center, and request
collapsing so a traffic burst produces one render. It also does exactly what the ticket
describes with headers alone. It is rejected for one reason only: **no zone-level purge,
including the dashboard button, touches it.** Its only invalidation path is
`ctx.cache.purge()`, called from inside the Worker, which means building an HTTP trigger and
hitting a URL — a different refresh lever than the one the map committed to.

If the "dashboard button" constraint is ever traded for "no storage + one manual action",
Workers Cache plus a secret purge route is the strictly better design. That is a decision for
T7, not a finding here.

---

## Q5 — Is `cache.delete()` data-center-local?

**Confirmed. It is useless as the refresh mechanism.**

> Global purges: The `cache.delete` method only purges content of the cache in the data center
> that the Worker was invoked. For global purges, refer to Purging assets stored with the Cache
> API.
> — https://developers.cloudflare.com/workers/runtime-apis/cache/

> Assets purged in this way are only purged locally to the data center the Worker runtime was
> executed.
> — https://developers.cloudflare.com/workers/reference/how-the-cache-works/

> Cache API is local to a data center, this means that `cache.match` does a lookup, `cache.put`
> stores a response, and `cache.delete` removes a stored response only in the cache of the data
> center that the Worker handling the request is in.
> — https://developers.cloudflare.com/workers/reference/how-the-cache-works/

A `cache.delete()` triggered from Oslo clears Oslo and leaves every other data center serving
the old shelf. Do not build a `/purge` route around it.

---

## Unresolved / low confidence

Read this section before treating the recommendation as settled.

1. **Purge Everything clearing Cache API entries rests on a single sentence.** The claim is
   explicit, current (page `dateModified` 2026-07-06), and on the canonical page — but exactly
   one page in Cloudflare's docs asserts it, and the same paragraph warns that "not all cache
   purge endpoints function for purging assets stored by the Cache API". **The entire design
   depends on this one sentence.** It is cheap to falsify empirically and it should be
   falsified before T7 is written: deploy the Worker, `curl` `/bookshelf` twice (second should
   return the identical timestamp), click Purge Everything, `curl` again and confirm the body
   changed. That five-minute test is worth more than any further reading. **Treat the design as
   provisional until it passes.**

2. **"Purge Everything" is worded around origin revalidation.** The purge-everything page says
   "Each new request for a purged resource returns to your origin server to validate the
   resource." There is no origin here. I found no doc describing what a purged Cache API entry
   does on the next request other than the `CF-Cache-Status: EXPIRED` note. The expected
   behaviour — `cache.match()` returns `undefined`, the Worker re-renders — is inference, not a
   quote. The empirical test in (1) covers this too.

3. **Purge-by-URL on Cache API entries is not confirmed.** Only Purge Everything and
   purge-by-tag are affirmatively listed. Purge-by-URL may or may not work. The `Cache-Tag:
bookshelf` header is in the recommendation precisely so there is a documented narrower lever
   that does not depend on this.

4. **Purge-by-tag on the Free plan is surprising.** The availability table lists Tag and Prefix
   purge as available on Free, which contradicts the long-standing understanding that those are
   Enterprise features. I quote the table as written and flag it: verify the Cache-Tag purge box
   actually appears in the dashboard for this zone before relying on it. Purge Everything is
   unambiguously available on Free either way, so nothing load-bearing rests on this.

5. **Eviction is undocumented and unbounded.** `s-maxage=31536000` is a ceiling, not a
   guarantee. Cloudflare's cache is LRU and an unpopular personal page may be evicted long
   before a year. No doc I found states a retention floor. This is not a correctness problem —
   an evicted entry just triggers a re-render from the PDS, and the content is identical — but
   "render once, then never again" is not what will actually happen. Expect periodic
   re-renders, per data center, at unpredictable intervals. T7 should not promise otherwise, and
   the note in the map about cold-render cost as the shelf grows is the right one to keep open.

6. **Interaction with static assets is out of scope here (T2).** If `/bookshelf` is served
   through a Worker that also has a static-assets binding, confirm the assets router does not
   intercept the path before the `fetch` handler runs. Nothing in this ticket's sources
   addresses that.

7. **No plan gating found on anything recommended**, but note the temporary Workers Cache
   restriction I came across while ruling that product out — "At launch, all Workers Caching
   responses are subject to the Free plan size limit regardless of your account's plan"
   (https://developers.cloudflare.com/workers/cache/limitations/). Irrelevant to the
   recommendation; recorded because it dates the product as recently launched, which supports
   the two-products reading in Q2.

---

## Sources read

All fetched 2026-08-09 as raw Markdown via `<url>/index.md`.

| Page                                                                             | `dateModified` |
| -------------------------------------------------------------------------------- | -------------- |
| https://developers.cloudflare.com/workers/reference/how-the-cache-works/         | 2026-07-06     |
| https://developers.cloudflare.com/workers/runtime-apis/cache/                    | 2026-07-06     |
| https://developers.cloudflare.com/workers/cache/                                 | 2026-07-21     |
| https://developers.cloudflare.com/workers/cache/purge/                           | 2026-07-06     |
| https://developers.cloudflare.com/workers/cache/limitations/                     | 2026-07-06     |
| https://developers.cloudflare.com/workers/cache/configuration/                   | 2026-07-06     |
| https://developers.cloudflare.com/workers/cache/cache-keys/                      | 2026-07-06     |
| https://developers.cloudflare.com/workers/platform/limits/                       | —              |
| https://developers.cloudflare.com/workers/examples/cache-api/                    | —              |
| https://developers.cloudflare.com/cache/how-to/purge-cache/                      | —              |
| https://developers.cloudflare.com/cache/how-to/purge-cache/purge-everything/     | 2026-04-16     |
| https://developers.cloudflare.com/cache/how-to/purge-cache/purge-by-tags/        | 2026-04-16     |
| https://developers.cloudflare.com/cache/how-to/cache-response-rules/             | —              |
| https://developers.cloudflare.com/cache/concepts/cache-control/                  | —              |
| https://developers.cloudflare.com/cache/concepts/default-cache-behavior/         | —              |
| https://developers.cloudflare.com/cache/concepts/cache-responses/                | —              |
| https://developers.cloudflare.com/cache/interaction-cloudflare-products/workers/ | 2026-07-06     |
