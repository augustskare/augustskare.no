<!-- label: wayfinder:map -->

# Bookshelf on augustskare.no, backed by atproto

## Destination

An implementation-ready spec for a `/bookshelf` page on augustskare.no, rendered per-request by a
Cloudflare Worker from the author's own `buzz.bookhive.book` atproto records, cached hard and
refreshed by hand. The spec covers the app, the caching contract, and the cutover from the
existing Cloudflare Pages deployment — enough that a separate session can build it without
reopening a decision.

## Notes

**Domain**: a personal one-page site (`augustskare.no`, a CV) growing a second page. Data lives in
the author's atproto repo at `did:plc:5zy6g7sxhhudcpyegms4l2n3`, collection `buzz.bookhive.book`,
written by [BookHive](https://bookhive.buzz). Hosting is Cloudflare, currently Pages.

**Skills**: `/grilling` and `/domain-modeling` by default; `/research` for the Cloudflare tickets,
`/prototype` for the page, `/wizard` for the cutover, `/to-spec` at the end.

**Standing preferences for this effort**

- **Plan, don't do.** This map produces a spec. The build is a separate session.
  **Overridden 2026-08-09**: after the three research tickets closed, the build ran ahead of
  T4–T7. Those tickets are still open and each now carries a "Provisional answer" section
  recording what the implementation decided on their behalf. They are decisions taken by an
  agent, not by the author — read them before treating the map as settled.
- **No content build step.** Finishing a book must never require a redeploy. This is the whole
  reason the site is moving off a static build.
- **No storage.** No KV, no D1, no database of any kind. Rules out stale-serving, cached
  renders-at-rest, and every form of automated refresh.
- **Manual refresh, permanently.** Cloudflare dashboard "Purge Everything" is the refresh lever.
- **`index.html` stays a hand-edited file**, not a JS template.
- **TypeScript**, formatted with the repo's existing `oxfmt`.
- **Small.** 58 records, two pages, one Worker. Resist machinery.

**Data facts** (sampled 2026-08-09, 58 records)

- `status`: `#finished` 39, `#wantToRead` 17, `#reading` 2. Only finished and reading are shown.
- Finished by year: 2026 (8), 2025 (12), 2024 (9), 2023 (9). One finished book,
  _Ut og stjæle hester_, has no `finishedAt` and is omitted.
- `authors` is always a single plain string. `createdAt` is worthless — everything was imported
  on one day.
- `com.atproto.repo.listRecords` is public and unauthenticated. `cover`, `stars`,
  `identifiers`, `hiveBookUri` and `owned` are all deliberately unused.

**Data path facts** (verified 2026-08-09 by [`research/data-path-probe.mjs`](research/data-path-probe.mjs),
a runnable reference implementation of the read)

- The full path works with three plain `fetch` calls and no SDK: `plc.directory` → PDS
  `serviceEndpoint` → `listRecords`.
- **`listRecords` returns a cursor even when the collection is exhausted.** Terminating the
  pagination loop on a missing cursor costs an extra empty round trip every render; terminate on
  a short page (`records.length < limit`) instead.
- A **cold read costs ~1.35s** — DID resolution plus one `listRecords` page. That is the latency
  a cache miss pays, with no stale fallback to hide it. Feeds the TTL decision in T7.
- **No HTML-escaping hazards in today's data** — no `<`, `>`, `&` or `"` in any title or author.
  This is a property of the current 58 records, not a guarantee; escaping is still required.
  Several authors have doubled internal spaces, which HTML collapses harmlessly.

## Decisions so far

<!-- one line per closed ticket -->

- [Which cache layer holds Worker HTML, and does dashboard Purge Everything clear it?](tickets/T1-worker-response-caching-and-purge.md)
  — Yes, provisionally. Use the classic Cache API (`caches.default`) with an explicit
  `cache.put()`; `Cache-Control: public, max-age=60, s-maxage=31536000` plus `Cache-Tag`. Headers
  alone cache nothing. The doc contradiction was two separate products. Rests on a single
  documented sentence, so it needs an empirical test on a real custom domain — which
  `workers.dev` cannot provide.
- [Mechanics of moving augustskare.no from Pages to a Worker](tickets/T3-pages-to-worker-cutover-mechanics.md)
  — Route first, Custom Domain last or never. A Custom Domain **cannot** be added while the Pages
  CNAME exists; a Route can, needs no DNS or certificate change, is zero-downtime, and rolls back
  by deleting it. The naive swap is the one sequence with an unbounded outage. Commit
  `wrangler.jsonc` with explicit `workers_dev: true` _before_ connecting the repo.
- [How Workers Static Assets and a single dynamic route coexist](tickets/T2-static-assets-alongside-worker-route.md)
  — Works cleanly; `index.html` stays hand-edited. `assets.directory: ./public` with
  `not_found_handling: "404-page"` **and** `run_worker_first: ["/bookshelf", "/bookshelf/*"]`. The
  `run_worker_first` entry is mandatory: without it a browser _navigation_ to `/bookshelf` is
  answered by `404.html` and the Worker never runs, while `fetch()` from JS works — a bug that
  passes scripted tests and fails every real visitor.

The destination grilling settled the shape before any ticket existed: `/bookshelf` as a "Reading
now" group above year groups descending, `<ol>` per year, title and author as plain text, no
covers or ratings or links; data read straight from the PDS with plain `fetch` after resolving the
DID via `plc.directory`; a TypeScript Worker with a static assets directory; long `s-maxage` with
dashboard purge; Workers Builds deploying on push to `main`.

## Not yet specified

- **What owns `/` if the assets binding disappoints.** The plan is that static assets serve the
  homepage without invoking Worker code. If T2 finds the routing semantics don't allow a clean
  split, the question of whether the Worker templates both pages reopens — which would also
  reopen the "`index.html` stays hand-edited" preference.
- **404 and robots behaviour.** Pages currently supplies 404 handling for free. The Worker must
  choose something. Too vague to ticket until T2 establishes what `not_found_handling` offers.
- **Cold-render cost as the shelf grows.** 58 records is one `listRecords` call today. Past ~100
  it paginates, and every cold render pays for it serially with no stale fallback to hide behind.
  Revisit once T7 fixes the TTL and the real cold-miss frequency is known.
- **Whether the prototype's markup survives contact with the Worker.** T5 builds the page as
  static HTML; how that becomes a template — tagged literal, plain string concatenation, escaping
  strategy for titles containing `&` or `<` — can't be specified until T6 fixes the source layout.

## Out of scope

- **Automated refresh** — cron polling, Jetstream/firehose subscription, change detection. Ruled
  out at charting: every route to it needs somewhere to keep state, and storage is excluded by
  preference. Returning to this means redrawing the destination, not resuming this map.
- **A homepage nav or discovery link to `/bookshelf`.** Explicitly deferred; the page is reachable
  by URL. Cheap to add later, and adding it changes nothing else.
- **Covers, star ratings, the want-to-read list, and links out to Goodreads or BookHive.** All
  present in the data, all deliberately dropped for a plain text list.
- **Writing to atproto.** Nothing authenticates; BookHive remains the only writer.
