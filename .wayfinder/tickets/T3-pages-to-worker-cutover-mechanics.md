---
id: T3
title: Mechanics of moving augustskare.no from Pages to a Worker
type: research
status: closed
assignee: claude (research agent, 2026-08-09)
blocked-by: []
---

## Question

`augustskare.no` currently resolves to Cloudflare and answers with
`cache-control: public, max-age=0, must-revalidate` — the signature of a Cloudflare Pages
project, deployed from the GitHub repo via the dashboard. The apex domain is live and is the
author's public CV, so the swap must not break it.

Establish, from Cloudflare's primary docs:

1. How a **custom domain** is attached to a Worker, and whether an apex domain already claimed
   by a Pages project can be added to a Worker while Pages still holds it — or whether it must
   be released first (and what the gap looks like if so).
2. The safe **ordering of operations** for the cutover, including how to verify the Worker on a
   `*.workers.dev` URL or a preview subdomain before touching the apex.
3. **Workers Builds**: how the git integration is configured, what it needs in the repo
   (`wrangler.jsonc`, build command, root dir), whether it supports a Worker with a static
   assets binding, and whether it deploys on push to `main` the way Pages does today.
4. **Rollback**: if the Worker is wrong after cutover, what is the fastest route back to the
   Pages deployment?
5. Whether the existing Pages project should be **deleted or left dormant**, and any DNS record
   left behind that needs cleaning up.

Answer feeds the cutover runbook (T8).

## Resolution

**Cut over with a Workers Route first, convert to a Custom Domain second — or never.** Full
sequence, quotes and downtime table:
[`research/T3-pages-to-worker-cutover-mechanics.md`](../research/T3-pages-to-worker-cutover-mechanics.md).

1. **A Custom Domain cannot be added first.** The apex is a CNAME to `<project>.pages.dev` (visible
   as A records only because of CNAME flattening), and the docs forbid it outright: "You cannot
   create a Custom Domain on a hostname with an existing CNAME DNS record." A **Route** has no such
   restriction — it needs only a proxied record, which already exists.
2. **The route cutover is zero-downtime.** No DNS change, no new certificate; the zone's Universal
   cert already covers the apex. "Routes … take precedence if configured on the same hostname", so
   the Worker starts answering within seconds while the Pages project stays fully intact.
3. **Rollback is deleting the route** — instant, one click, Pages resumes untouched. This is the
   entire argument for route-first.
4. **The naive one-shot swap is the dangerous path.** Deleting the Pages CNAME and adding a Custom
   Domain has an _unbounded_ worst case — Cloudflare publishes no activation SLA, and a stuck
   certificate means the CV is offline rather than merely served from a route.
5. **Converting route → Custom Domain is optional and goes last.** A Worker on a route serves the
   apex correctly forever. If skipped, keep a proxied `AAAA 100::` placeholder record.

### Repo prerequisites, before connecting the repo to Workers Builds

- Commit `wrangler.jsonc` **first**. Connecting a config-less repo triggers autoconfig, which opens
  an unsolicited PR.
- Set `"workers_dev": true` **explicitly** — adding a `routes` block otherwise silently turns the
  `workers.dev` subdomain off, and that subdomain is needed to verify before cutover.
- Pin `wrangler` in `devDependencies`; Workers Builds uses the version from `package.json`.
- Build command: empty. Root directory: empty. Deploy command: default `npx wrangler deploy`.
  Branch: `main`. The Worker name must equal `name` in `wrangler.jsonc`.
- **Pages' implicit 404 behaviour is not inherited** — `assets.not_found_handling` must be set
  explicitly. Feeds T2/T6.

### Caveat

Route-taking-precedence-over-Pages is _inferred_: the quote documents routes vs Worker Custom
Domains, not vs Pages. It is verifiable in seconds and undoable in one click, so the risk is
bounded — but the runbook should treat step 5 as a checkpoint, not an assumption.
