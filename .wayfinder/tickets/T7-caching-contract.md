---
id: T7
title: Pin the caching contract for /bookshelf
type: grilling
status: open
assignee:
blocked-by: [T1]
---

## Question

Turn T1's findings into the exact caching behaviour the implementation must have.

Invoke `/grilling`.

Decide:

1. The precise **response headers** on `/bookshelf`, and the cache layer they target. Whether a
   Cache Rule is needed in the dashboard, and if so, exactly what it matches.
2. The **TTL number**. "Very long" needs to be a value. A year is defensible when purging is
   manual and permanent; so is a day as a safety net against forgetting to purge. This is a
   trade between "always fresh after a click" and "self-heals if you never click".
3. **Cacheability of the error state**. This is the sharpest edge in the design: with no KV and
   no stale fallback, one cache miss during a PDS outage could write an error page into the edge
   cache for the full TTL, and only a manual purge would remove it. Decide the error response's
   headers — almost certainly `no-store` — and confirm the chosen layer honours them.
4. What happens on the **first request after a deploy**. Does a Workers Builds deploy invalidate
   the cache, or does the old render survive it? Determines whether shipping a template change
   requires a manual purge too.
5. Whether the **`plc.directory` DID resolution** is cached separately and for how long. DID docs
   change roughly never, but the lookup is a second network hop on every cold render.
6. Whether anything on the page should reveal **when it was rendered** — a "last updated"
   timestamp makes staleness legible instead of mysterious, at the cost of putting a date on a
   page that may be a year old.

Feeds the cutover runbook (T8) and the final spec (T9).

## Provisional answer — decided by the implementation, not yet confirmed

Implemented in `src/index.ts`. The parts this ticket still owns are flagged.

- Headers as T1 recommended: `Cache-Control: public, max-age=60, s-maxage=31536000`,
  `Cache-Tag: bookshelf`, explicit `caches.default.put()`. No Cache Rule.
- **The error response is `no-store`** and is never `put()` — the sharpest edge in the design,
  covered by a regression test.
- **The cache key is normalised** to `https://<host>/bookshelf`, discarding method and query
  string. Two bugs made this necessary: the Cache API rejects `put()` for non-GET, so HEAD threw;
  and `/bookshelf?anything` otherwise minted an unbounded number of cache misses, each a fresh
  crawl of the PDS.
- **Still open, decided by omission:** the year-long TTL was taken from T1's example rather than
  reasoned about (question 2); `plc.directory` DID resolution is _not_ cached separately, so every
  cold render pays two hops (question 5); and there is no "last updated" stamp on the page
  (question 6) — the one staleness cue a year-long TTL arguably needs.
