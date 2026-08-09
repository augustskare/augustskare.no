---
id: T8
title: Write the Pages-to-Worker cutover runbook
type: task
status: open
assignee:
blocked-by: [T3, T7]
---

## Question

Produce the step-by-step runbook for moving the live apex domain `augustskare.no` off the
existing Cloudflare Pages project and onto the Worker. This is the step where a real, public site
can break, so it gets planned rather than improvised.

Invoke `/wizard` — the output should be a script that walks a human through the dashboard clicks
and verifications, since most of these steps cannot be done by an agent.

Must cover, using what T3 established:

1. Pre-flight: the Worker verified on a `workers.dev` URL, both `/` and `/bookshelf` correct.
   **Caveat from T1**: `workers.dev` and Playground previews have no functional Cache API, so
   this step can only prove the _rendering_, never the caching. Decide how to prove the caching
   before the apex moves — the suggestion from T1 is a throwaway custom domain on the same zone
   (e.g. `shelf-test.augustskare.no`), which has a real zone-scoped cache.

   **Synthesis of T1 and T3**: the cheapest way to get that is T3's own mechanism — a **Route** on
   `shelf-test.augustskare.no/*` plus a proxied `AAAA 100::` record for that subdomain. That is a
   real hostname on the real zone, so the Cache API functions and zone Purge Everything reaches it,
   while the apex stays on Pages and nothing is at risk. The full render → hit → purge → re-render
   test runs there, and the apex route is only added once it passes.

2. The ordering of releasing the domain from Pages and attaching it to the Worker, with the
   expected downtime window stated honestly.
3. Setting up Workers Builds against the GitHub repo, and confirming push-to-main deploys.
4. Verifying the caching contract from T7 **against the live domain** — that the first request
   populates the cache, subsequent requests hit it, and dashboard Purge Everything actually
   causes the next request to re-render. This is the acceptance test for the entire design.
5. Rollback steps if any check fails.
6. Cleanup: retiring the Pages project and any stale DNS records.
