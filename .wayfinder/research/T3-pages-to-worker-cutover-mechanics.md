# T3 — Mechanics of moving `augustskare.no` from Pages to a Worker

Researched 2026-08-09 against `developers.cloudflare.com` primary docs (raw Markdown via
`…/index.md`). Every quote below is verbatim from the page linked beside it.

Observed live state (2026-08-09):

```
$ dig +short augustskare.no        →  104.21.6.48 / 172.67.154.236   (Cloudflare anycast)
$ dig +short augustskare.no NS     →  cecelia.ns.cloudflare.com. / tadeo.ns.cloudflare.com.
$ curl -sSI https://augustskare.no/
  cf-cache-status: HIT
  cache-control: public, max-age=0, must-revalidate
```

So: full Cloudflare zone (Cloudflare nameservers), apex proxied, Pages' cache signature. The apex
answers with A records because of [CNAME flattening](https://developers.cloudflare.com/dns/cname-flattening/)
— _"CNAME flattening speeds up CNAME resolution and allows you to use a CNAME record at your zone
apex (`example.com`)."_ The record **in the zone** is a CNAME to `<project>.pages.dev`; the record
**on the wire** is an A. This distinction is the crux of question 1.

---

## RECOMMENDATION

**Cut over with a Workers Route first, convert to a Custom Domain second.** This is the only
ordering that gets the Worker onto the live apex with no DNS gap and no dependency on new
certificate issuance, and whose rollback is a single instant delete.

### Ordered sequence

**Phase 0 — prepare the repo (no production impact)**

1. Add `wrangler` to `devDependencies` (Workers Builds _"will use the Wrangler version set in your
   package json"_) and commit a `wrangler.jsonc` at the repo root with `name`,
   `compatibility_date`, `main`, and `assets.directory` pointing at `site/`, plus
   `assets.not_found_handling` (Pages' implicit 404 behaviour is **not** inherited). Do this
   **before** connecting the repo — a repo with no Wrangler config triggers autoconfig, which opens
   an unwanted PR (Q3).
2. Set `"workers_dev": true` explicitly. Adding a `routes` block otherwise silently turns
   `workers.dev` off, and you need `workers.dev` for step 4.

**Phase 1 — build and verify off-domain (no production impact)**

3. Create the Worker and connect the GitHub repo in **Workers & Pages → Create application →
   Import a repository**. Worker name **must equal** the `name` in `wrangler.jsonc`. Build command:
   leave empty (there is no build step). Deploy command: default `npx wrangler deploy`. Root
   directory: leave empty. Branch: `main`.
4. Verify on `https://<worker-name>.<subdomain>.workers.dev` — homepage, `/bookshelf`, 404
   behaviour, headers. Iterate here freely; `augustskare.no` is untouched and still on Pages.

**Phase 2 — the cutover (expected downtime: none)**

5. Add a **Route** `augustskare.no/*` (zone `augustskare.no`) to the Worker, via dashboard or
   `routes` in `wrangler.jsonc`. Do **not** touch DNS. The existing proxied Pages CNAME satisfies
   the route's DNS-record requirement, and _"Routes … take precedence if configured on the same
   hostname."_ The Worker starts answering the apex within seconds of the route being saved. TLS is
   unaffected: the zone's Universal certificate already covers the apex, and no new certificate is
   ordered.
6. Verify on the real apex: `curl -sSI https://augustskare.no/`. Pages' fingerprint
   (`cache-control: public, max-age=0, must-revalidate`) should be gone and replaced by whatever the
   Worker sends. **Soak here for as long as you like** — hours or days. Pages remains fully intact
   and re-armable.

**Phase 3 — retire Pages (expected downtime: seconds, one DNS-record swap)**

7. Turn off Pages auto-deploys: Pages project → **Build → Branch control → Enable automatic
   production branch deployments** off. (This is the step the official migration guide names.)
8. In **DNS → Records**, _edit_ the apex CNAME → change it to a **proxied `AAAA` to `100::`**
   (Cloudflare's documented originless placeholder). Editing in place is one atomic write, so the
   authoritative answer never goes empty; and because both the old and new record are proxied, the
   public answer is the same anycast IPs before and after. This detaches Pages from the hostname —
   Cloudflare's own "Delete a custom domain" procedure for Pages _is_ deleting this record.
9. Pages project → **Custom domains** → three-dot → **Remove domain**.
10. Convert Route → Custom Domain (Cloudflare's documented "Migrate from Routes" flow): delete the
    `AAAA 100::` record, add the Custom Domain `augustskare.no` on the Worker (Cloudflare recreates
    the DNS record and orders an Advanced Certificate), then delete the `augustskare.no/*` route.
    **This step has a real, unbounded gap** — see the downtime note below. It is optional; a Worker
    on a route serves the apex correctly forever. If you skip it, keep the `AAAA 100::` record.
11. Leave the Pages project dormant for a couple of weeks, then delete it
    (`npx wrangler pages project delete augustskare-no`).

### Honest downtime

| Step                                                             | Expected                                                                              | Worst case                                                                                                                                                                                                |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Phase 2 (add route)                                              | **Zero.** No DNS change, no cert change.                                              | Route propagation, seconds.                                                                                                                                                                               |
| Phase 3 step 8 (CNAME → AAAA `100::`)                            | **Zero to a few seconds.** Same proxied anycast answer either side of an atomic edit. | A resolver querying inside the write window caches NODATA for the record TTL (Auto = 300 s).                                                                                                              |
| Phase 3 step 10 (route → Custom Domain), **if you do it**        | ~30 s – 5 min of apex not resolving                                                   | **Unbounded.** Cloudflare documents no SLA for Custom Domain activation, and community reports exist of the status sitting at "Initializing" for hours. This is why it is last, optional, and reversible. |
| The naive one-shot swap (delete Pages CNAME → add Custom Domain) | 1–5 min hard outage                                                                   | Same unbounded tail, but with **no working site** the whole time instead of a working Worker.                                                                                                             |

**Do not do the naive one-shot swap.** It is the obvious reading of the docs and it is the one
sequence where a stuck certificate means the CV is offline rather than merely on a route.

### Rollback

- **After Phase 2, before Phase 3:** delete the Worker route. Instant, single click, Pages resumes
  serving. Nothing else was changed. This is the whole reason to do Phase 2 as a route.
- **After Phase 3 step 8/9:** re-add `augustskare.no` as a Pages custom domain — but you must delete
  the Worker route first, because Pages _"is currently not possible to add a custom domain with … a
  Worker already routed on that domain."_ Budget minutes, not seconds.
- **Bad Worker code, domain fine:** Worker → **Deployments** → three-dot → **Rollback**. _"Rolling
  back to a previous version of your Worker will immediately create a new deployment with the
  version specified and become the active deployment across all your deployed routes and domains."_
  Limit: 100 most recent versions.
- **Bad Pages content (pre-cutover only):** Pages → Deployments → _"Rollback to this deployment"_;
  _"your project's production deployment will change instantly."_

---

## Evidence

### Q1 — How a custom domain attaches to a Worker; can Pages and the Worker hold the apex at once?

**Custom Domains vs Routes — the difference.**

> There are three types of routes:
>
> - **Custom Domains**: Routes to a domain or subdomain (such as `example.com` or
>   `shop.example.com`) within a Cloudflare zone where the Worker is the origin.
> - **Routes**: Routes that are set within a Cloudflare zone where your origin server, if you have
>   one, is behind a Worker that the Worker can communicate with.
> - **workers.dev**: A `workers.dev` subdomain route is automatically created for each Worker…

> Custom Domains are recommended for use cases where your Worker is your application's origin
> server. […] Routes are recommended for use cases where your application's origin server is
> external to Cloudflare.

— <https://developers.cloudflare.com/workers/configuration/routing/>

**Which is right here.** End state: Custom Domain. The Worker _is_ the origin (static assets +
`/bookshelf`), it needs every path on the apex, and Custom Domains are what Cloudflare recommends
for exactly that. Apex is explicitly in scope (`example.com` is the doc's own example). But _during_
the cutover a Route is the correct tool, because a Route is the only one of the two that can be
layered onto a hostname whose DNS record is already owned by something else.

**What adding a Custom Domain does.**

> Custom Domains allow you to connect your Worker to a domain or subdomain, without having to make
> changes to your DNS settings or perform any certificate management. After you set up a Custom
> Domain for your Worker, Cloudflare will create DNS records and issue necessary certificates on
> your behalf. The created DNS records will point directly to your Worker. Unlike Routes, Custom
> Domains point all paths of a domain or subdomain to your Worker.

> Creating a Custom Domain will also generate an Advanced Certificate on your target zone for your
> target hostname.

— <https://developers.cloudflare.com/workers/configuration/routing/custom-domains/>

**The blocking constraint — decisive for this question:**

> Caution
> **You cannot create a Custom Domain on a hostname with an existing CNAME DNS record or on a zone
> you do not own.**

— <https://developers.cloudflare.com/workers/configuration/routing/custom-domains/>

**And Pages' apex custom domain _is_ a CNAME record:**

> To use a custom apex domain (for example, `example.com`) with your Pages project, configure your
> nameservers to point to Cloudflare's nameservers. If your nameservers are successfully pointed to
> Cloudflare, **Cloudflare will proceed by creating a CNAME record for you.**

— <https://developers.cloudflare.com/pages/configuration/custom-domains/>

**Answer:** No. A Workers **Custom Domain** cannot be added to `augustskare.no` while the Pages
project holds it — the Pages-created apex CNAME is precisely the record the Caution forbids. Pages
must release the hostname first, and Cloudflare's own release procedure is "delete the DNS record,
then remove the domain from the project":

> To detach a custom domain from your Pages project, you must modify your zone's DNS records.
>
> 1. Go to the **DNS Records** page … 2. Locate your Pages project's CNAME record. 3. Select
>    **Edit**. 4. Select **Delete**. 5. … 6. Select your Pages project. 7. Go to **Custom domains**.
> 2. Select the three dot icon next to your custom domain > **Remove domain**.

— <https://developers.cloudflare.com/pages/configuration/custom-domains/>

**The gap, and what a visitor sees.** Between deleting the CNAME and the Custom Domain's record
going live, the apex has no record in the zone. Resolvers holding the flattened A answer keep
working until its TTL expires (Cloudflare "Auto" = 300 s); everyone else gets an empty answer —
browser `DNS_PROBE_FINISHED_NXDOMAIN` / "server IP address could not be found", not a Cloudflare
error page. Cloudflare publishes **no** activation-time guarantee for a Workers Custom Domain, and
community threads report the status stalling ("Initializing" for hours) in bad cases. Pages'
own docs warn about the same shape of problem in the reverse direction:

> Once a custom domain is set up, if you change the DNS entry to point to something else (for
> example, your origin), the custom domain will become inactive. If you then change that DNS entry
> to point back at your custom domain, **anybody using that DNS entry to visit your website will get
> errors until it becomes active again.**

— <https://developers.cloudflare.com/pages/configuration/custom-domains/#change-dns-entry-away-from-pages-and-then-back-again>

**A **Route**, by contrast, needs no DNS change at all** — only that a proxied record already exist,
which it does:

> To add a route, you must have: 1. An active Cloudflare zone. 2. A Worker to invoke. 3. **A DNS
> record set up for the domain or subdomain proxied by Cloudflare** (also known as orange-clouded)
> you would like to route to.

> **Routes can `fetch()` Custom Domains and take precedence if configured on the same hostname.** If
> you would like to run a logging Worker in front of your application, for example, you can create a
> Custom Domain on your application Worker for `app.example.com`, and create a Route for your
> logging Worker at `app.example.com/*`.

— <https://developers.cloudflare.com/workers/configuration/routing/routes/>

TLS during the route phase is covered by the existing zone certificate; no new issuance is needed:

> On a full setup, Universal SSL certificates cover your root domain (for example, `example.com`)
> and first-level subdomains (for example, `www.example.com`).

— <https://developers.cloudflare.com/ssl/edge-certificates/universal-ssl/>

Corroborating that Cloudflare treats "a Worker routed on the domain" as a state that can coexist
with (and blocks) a Pages custom domain — i.e. routes are not gated on Pages' claim:

> It is currently not possible to add a custom domain with … a Worker already routed on that domain.

— <https://developers.cloudflare.com/pages/platform/known-issues/#custom-domains>

Confidence note: Cloudflare documents "route takes precedence on the same hostname" for a Worker
Custom Domain behind it, not specifically for a **Pages** project behind it. The mechanism is the
same (route evaluation happens before origin selection) and the Pages known-issue above implies the
combination is recognised, but this specific pairing is not spelled out in the docs. Verify
empirically with `curl -sSI` immediately after adding the route — that is a 5-second check with a
5-second undo.

### Q2 — Safe ordering, and verifying on `workers.dev` first

Every Worker gets a `workers.dev` URL for free:

> All Workers are assigned a `workers.dev` route when they are created or renamed following the
> syntax `<YOUR_WORKER_NAME>.<YOUR_SUBDOMAIN>.workers.dev`. The name field in your Worker
> configuration is used as the subdomain for the deployed Worker.

> It's recommended to run production Workers on a Workers route or custom domain, rather than on
> your `workers.dev` subdomain. Your `workers.dev` subdomain is treated as a Free website and is
> intended for personal or hobby projects that aren't business-critical.

— <https://developers.cloudflare.com/workers/configuration/routing/workers-dev/>

**Trap:** adding `routes` to the Wrangler file silently kills it —

> If you do not specify `workers_dev = false` but add a routes component to your Wrangler
> configuration file, **the value of `workers_dev` will be inferred as `false` on the next deploy.**

— same page. Set `"workers_dev": true` explicitly if you want to keep the verification URL after
Phase 2.

Per-version preview URLs are also available and are the better verification surface for the
Workers Builds flow:

> Every time you create a new version of your Worker, a unique static version preview URL is
> generated automatically. These URLs use a version prefix and follow the format
> `<VERSION_PREFIX>-<WORKER_NAME>.<SUBDOMAIN>.workers.dev`.
> […] If Preview URLs have been enabled, they are public and available immediately after version
> creation.
>
> - Preview URLs are enabled by default when `workers_dev` is enabled.

— <https://developers.cloudflare.com/workers/versions-and-deployments/preview-urls/>

Ordering follows from Q1: **repo config → Worker created & building → verified on workers.dev →
route added to apex → verified on apex → Pages detached → (optionally) route converted to Custom
Domain → Pages deleted.** The migration guide's own sequencing agrees that CI is swapped before
Pages is wound down, and that deletion is the last act:

> If you are using Pages' built-in CI/CD system, you can swap this for Workers Builds by first
> connecting your repository to Workers Builds and then disabling automatic deployments on your
> Pages project.

> **Once you have validated the behavior of Worker, and are satisfied with the development
> workflows, and have migrated all of your production traffic, you can delete your Pages project**
> in the Cloudflare dashboard or with Wrangler.

— <https://developers.cloudflare.com/workers/static-assets/migration-guides/migrate-from-pages/>

### Q3 — Workers Builds

**It is the direct equivalent of Pages' git integration, and it deploys on push:**

> Cloudflare supports connecting your GitHub and GitLab repository to your Cloudflare Worker, and
> **will automatically deploy your code every time you push a change.**

— <https://developers.cloudflare.com/workers/ci-cd/builds/git-integration/>

> The Cloudflare Git integration lets you connect a new or existing Worker to a GitHub or GitLab
> repository, enabling automated builds and deployments for your Worker on push.

— <https://developers.cloudflare.com/workers/ci-cd/builds/>

**Two-step model, and both steps have defaults:**

> When a commit is pushed to your connected repository, Workers Builds runs a two-step process:
>
> 1. **Build command** _(optional)_ – Compiles your project (for example, `npm run build` …)
> 2. **Deploy command** – Deploys your Worker to Cloudflare (**defaults to `npx wrangler deploy`**)
>
> For preview builds (commits to branches other than your production branch), the deploy command is
> replaced with a **preview deploy command** (defaults to `npx wrangler versions upload`) …

— <https://developers.cloudflare.com/workers/ci-cd/builds/configuration/>

Settings that matter here, from the same page's table:

- **Git branch** — _"Select the branch you would like Cloudflare to listen to for new commits. This
  will be defaulted to main."_ → matches today's Pages behaviour, no action needed.
- **Build command** _(Optional)_ — _"Set a build command if your project requires a build step."_
  This repo has none (`package.json` scripts are `dev` / `fmt` / `fmt:check` only, and `site/` is
  hand-written `index.html` + a font). **Leave it empty.**
- **Root directory** _(Optional)_ — _"Specify the path to your project. The root directory defines
  where the build command will be run…"_ → leave empty; `wrangler.jsonc` goes at the repo root.
- **Deploy command** — _"defaults to `npx wrangler deploy`. […] Workers Builds will use the Wrangler
  version set in your package json."_ → add `wrangler` to `devDependencies` so the version is pinned
  rather than whatever `npx` resolves that day.

**Name must match, or the build fails:**

> Caution
> When connecting a repository to a Workers project, **the Worker name in the Cloudflare dashboard
> must match the `name` in the Wrangler configuration file** in the specified root directory, or the
> build will fail.

— <https://developers.cloudflare.com/workers/ci-cd/builds/>

**Connecting a repo with no Wrangler config has a side effect** — relevant, since this repo has none
today:

> When you connect a repository that does not have a Wrangler configuration file, **autoconfig runs
> to detect your framework and create a pull request** to configure your project for Cloudflare
> Workers.

— <https://developers.cloudflare.com/workers/ci-cd/builds/>

→ Commit `wrangler.jsonc` **before** connecting the repo, or you get an unsolicited PR.

**Static assets: yes, fully supported.**

> Where you previously would configure a "build output directory" for Pages …, you must now set the
> `assets.directory` value for a Worker project.

> Note: If your Worker will only contain assets and no Worker script, then you should remove the
> `"binding": "ASSETS"` field from your configuration file, since this is only valid if you have a
> Worker script indicated by a `"main"` property.

> Workers … will default to serving static assets ahead of your Worker script, unless you have
> configured `assets.run_worker_first`.

— <https://developers.cloudflare.com/workers/static-assets/migration-guides/migrate-from-pages/>

The compatibility matrix on that page lists **Assets binding: Workers ✅**, and the builds config
page lists `npx wrangler deploy --assets ./public/` as a stock deploy command, so the CI path is
first-class. Note also, for the T2/T6 questions the map leaves open:

> Pages would automatically attempt to determine the type of project you deployed. It would look for
> `404.html` and `index.html` files as signals … In Workers, to prevent accidental misconfiguration,
> **this behavior is explicit and must be set up manually.**

— same page. Pages' free 404 handling does **not** carry over; `not_found_handling` must be chosen.

`_headers` and `_redirects` do carry over: _"`_headers` and `_redirects` files are supported natively
in Workers with static assets."_

**Plan gating (Free plan is fine):**

| Metric            | Free plan       | Paid plans                                 |
| ----------------- | --------------- | ------------------------------------------ |
| Build minutes     | 3,000 per month | 6,000 per month (then, +$0.005 per minute) |
| Concurrent builds | 1               | 6                                          |
| Build timeout     | 20 minutes      | 20 minutes                                 |

— <https://developers.cloudflare.com/workers/ci-cd/builds/limits-and-pricing/>

A no-build-step deploy of two files will consume well under a minute per push. Nothing in the
cutover requires a paid plan: Custom Domains, Routes, Workers Builds, static assets, rollbacks and
preview URLs are all listed without plan gates. (Gradual deployments are Workers-only and unrelated;
the one genuine Pages→Workers regression on Free is that Workers _"does not support any domain whose
nameservers are not managed by Cloudflare"_ — irrelevant here, the zone is on Cloudflare NS.)

**To stop deploying while keeping builds:**

> To disable automatic deployments while still allowing builds to run automatically and save as
> versions (without promoting them to an active deployment), update your deploy command to:
> `npx wrangler versions upload`.

— <https://developers.cloudflare.com/workers/ci-cd/builds/>

### Q4 — Rollback

Three distinct failure modes, three different levers.

**(a) The Worker is wrong but the domain wiring is fine** — roll the Worker back:

> You can roll back to a previously deployed version of your Worker using Wrangler or the Cloudflare
> dashboard. **Rolling back to a previous version of your Worker will immediately create a new
> deployment with the version specified and become the active deployment across all your deployed
> routes and domains.**

> ### Rollbacks limit
>
> You can only roll back to the 100 most recently published versions.

— <https://developers.cloudflare.com/workers/versions-and-deployments/rollbacks/>

**(b) The Worker is wrong and you want Pages back, and you cut over with a Route (Phase 2)** —
delete the route. Nothing else changed: the Pages CNAME is still in DNS, the Pages custom domain is
still attached, the last Pages production deployment is still live. This is the fastest possible
route back and it is why the route-first ordering is recommended. Measured in seconds.

**(c) You want Pages back after Phase 3** — you must re-attach the custom domain to Pages, and you
must remove the Worker's route/Custom Domain first:

> It is currently not possible to add a custom domain with … **a Worker already routed on that
> domain.**

— <https://developers.cloudflare.com/pages/platform/known-issues/#custom-domains>

Then re-run _"Add a custom domain"_ on the Pages project
(<https://developers.cloudflare.com/pages/configuration/custom-domains/>). Expect minutes and the
re-activation warning quoted in Q1 ("anybody using that DNS entry to visit your website will get
errors until it becomes active again"). The Pages project must still exist — which is the argument
for leaving it dormant (Q5).

**Pages content rollback (only useful before cutover):**

> Rollbacks allow you to **instantly revert your project to a previous production deployment.** […]
> When confirmed, your project's production deployment will change instantly.

— <https://developers.cloudflare.com/pages/configuration/rollbacks/>

One reassurance for (c): the Advanced Certificate the Worker Custom Domain leaves behind does not
block Pages, because Pages' certificate outranks it —

> | Priority | Certificate Type |
> | 4 | Custom Hostname (Cloudflare for SaaS) |
> | 5 | Advanced |

— <https://developers.cloudflare.com/ssl/reference/certificate-and-hostname-priority/>, and
correspondingly _"Advanced Certificates cannot be used with Cloudflare Pages due to Cloudflare for
SaaS's certificate prioritization"_
(<https://developers.cloudflare.com/pages/platform/known-issues/>).

### Q5 — Delete or leave the Pages project dormant? What DNS is left behind?

**Cloudflare's guidance is delete, but only at the end:**

> Once you have validated the behavior of Worker, and are satisfied with the development workflows,
> and have migrated all of your production traffic, you can delete your Pages project in the
> Cloudflare dashboard or with Wrangler:
> `npx wrangler pages project delete`

— <https://developers.cloudflare.com/workers/static-assets/migration-guides/migrate-from-pages/>

`npx wrangler pages project delete [PROJECT-NAME]`, `--yes` to skip confirmation
(<https://developers.cloudflare.com/workers/wrangler/commands/pages/>).

**Recommendation: leave it dormant for ~2 weeks, then delete.** Dormant costs nothing, and it is the
only thing that makes rollback path (c) possible. Make it _properly_ dormant, not merely idle:

> Navigate to **Build** > edit **Branch control** > turn off **Enable automatic production branch
> deployments**. You can also change your Preview branch to **None (Disable automatic branch
> deployments)** to pause automatic preview deployments.

— <https://developers.cloudflare.com/pages/configuration/git-integration/#disable-automatic-deployments>

Without this, every push to `main` keeps building a Pages deployment forever — harmless but noisy,
and it will silently keep the Pages project's idea of "production" fresh.

Two facts that argue for _not_ deleting hastily:

> `*.pages.dev` subdomains currently cannot be changed. If you need to change your `*.pages.dev`
> subdomain, delete your project and create a new one.

> If you deploy using the Git integration, you cannot switch to Direct Upload later.

— <https://developers.cloudflare.com/pages/platform/known-issues/>

Deleting is a one-way door for the project's identity; recreating it later is a new project.

And one that argues for eventually deleting: a project with many deployments becomes hard to remove —

> You may not be able to delete your Pages project if it has a high number (over 100) of
> deployments. […] As a workaround, you can use `wrangler pages deployment delete` to delete
> deployments individually.

— <https://developers.cloudflare.com/pages/platform/known-issues/>

**DNS and certificate leftovers to clean up:**

1. **The apex CNAME to `<project>.pages.dev`** — Cloudflare created it when the Pages custom domain
   was added and it is what blocks the Workers Custom Domain (Q1). Under the recommended plan it is
   _edited_ into a proxied `AAAA 100::` in Phase 3 step 8, then deleted in step 10 when the Custom
   Domain is created. `192.0.2.0` (A) and `100::` (AAAA) are Cloudflare's documented
   _"reserved placeholder addresses … for originless setups"_
   (<https://developers.cloudflare.com/workers/configuration/routing/custom-domains/>).
2. **The Pages "Custom domains" entry** — removing the DNS record does not remove it from the
   project; the two-part procedure in the Pages docs (quoted in Q1) must be completed.
3. **The Advanced Certificate created by the Worker Custom Domain** — this is the one Cloudflare
   explicitly warns is orphaned:
   > **When you delete a Custom Domain, the associated Advanced Certificate is not automatically
   > deleted.** You must manually remove the certificate from the Cloudflare dashboard under
   > **SSL/TLS > Edge Certificates**, or via the API. Leaving unused certificates in place does not
   > affect functionality but may cause confusion when auditing your certificate inventory.
   > — <https://developers.cloudflare.com/workers/configuration/routing/custom-domains/>
4. **The `*.pages.dev` hostname** stays reachable and public for as long as the project exists.
   Pages offers no switch to turn it off — only _"Redirect the `*.pages.dev` URL … to a custom
   domain"_ via Bulk Redirects
   (<https://developers.cloudflare.com/pages/configuration/custom-domains/#disable-access-to-pagesdev-subdomain>).
   Deleting the project is the only real removal.
5. **No `www` record exists or is needed** — augustskare.no is apex-only. Worth knowing that Workers
   Custom Domains would not cover `www` even if it appeared: _"Because Custom Domains require an
   exact hostname match, a Worker attached to `example.com` will not receive requests sent to
   `www.example.com`, and vice versa."_ (same page).

---

## Unresolved / low confidence

- **Route-over-Pages is inferred, not documented.** Cloudflare documents _"Routes … take precedence
  if configured on the same hostname"_ only in the context of a Worker **Custom Domain** sitting
  behind the route. Nothing in the docs states what happens when the thing behind the route is a
  **Pages** project's custom hostname. The mechanism should be identical and the Pages known-issue
  ("cannot add a custom domain with a Worker already routed on that domain") implies Cloudflare
  recognises the combination — but this is the one load-bearing inference in the recommendation.
  **Mitigation: it is verifiable in five seconds with `curl -sSI https://augustskare.no/` and
  undoable in five seconds by deleting the route.** If it does not work, fall back to the naive
  one-shot swap (delete CNAME → add Custom Domain immediately) and accept the outage window.
- **How long a Workers Custom Domain takes to activate.** Cloudflare publishes no number, no SLA,
  and no "expect N minutes" line anywhere in the Workers routing or SSL docs. Community reports span
  seconds to hours. The estimate of "30 s – 5 min, unbounded tail" above is calibrated from those
  reports, not from primary documentation. Treat it as the reason to sequence this step last.
- **Whether a Worker may share a name with a live Pages project in the same account.** The migration
  guide says the Worker name _"can be the same as your existing Pages project name, so long as it
  conforms to Workers' name restrictions"_ — but that sentence describes the end state, not a period
  where both objects exist side by side. Not resolvable from docs. **Cheapest handling: name the
  Worker something distinct from the Pages project** (they are separate objects with separate
  `workers.dev` / `pages.dev` hostnames anyway) and skip the question entirely.
- **What DNS record type a Workers Custom Domain actually creates.** The docs say only _"Cloudflare
  will create a new DNS record for you"_ and _"The created DNS records will point directly to your
  Worker"_ — no record type is stated. It matters only for recognising the row in the DNS tab
  afterwards, not for any decision here.
- **Exact behaviour of an in-place DNS record _type_ change (CNAME → AAAA) in the dashboard.** The
  plan assumes the dashboard's **Edit** applies this as one atomic update rather than a
  delete-then-create. Not documented. If the dashboard refuses to change record type in place, the
  fallback is delete-then-immediately-create, whose exposure is one authoritative-write window
  against a 300 s negative-cache TTL — small, but not zero.
- **Whether deleting the Pages project removes any remaining DNS record.** Not documented either
  way. Under the recommended plan the record has already been replaced by then, so it does not
  arise; check the DNS tab after deletion regardless.
- **`wrangler rollback` command reference.** The Rollbacks page links to
  `workers/wrangler/commands/general/#rollback`, but that anchor was not present in the page content
  retrieved on 2026-08-09 (the general-commands page appears to have been split). The dashboard
  rollback path is documented and unambiguous; use it, or confirm the CLI spelling against
  `wrangler rollback --help` at runbook-writing time.
