---
id: T6
title: Repo structure, shared stylesheet, and local dev
type: grilling
status: open
assignee:
blocked-by: [T2]
---

## Question

The repo today is `site/index.html` (147 lines, CSS inline in a `<style>` block),
`site/hubot.woff2`, and a `package.json` whose dev command is `http-server site`. It becomes a
TypeScript Worker with an assets directory and a stylesheet shared by two pages.

Invoke `/grilling`.

Decide:

1. The **directory layout**. Where do assets live (`assets/`, `public/`, keep `site/`), where does
   Worker source live (`src/`), and what does `wrangler.jsonc` point at? Constrained by whatever
   T2 establishes about the assets binding.
2. **Extracting the stylesheet**. The CSS is currently inline in `index.html`, which means it
   ships with zero extra requests and can never go stale against the HTML. Pulling it into a
   linked file adds a request and a cache-busting question. Decide the filename, and whether it
   needs a hash or version in its URL given the site is cached hard and purged only by hand —
   note this interacts with T1's purge story.
3. Does `index.html` keep the `@font-face` block, or does that move to the shared stylesheet
   along with everything else?
4. **Local dev**: does `wrangler dev` replace `http-server`, and what happens to the `dev` script
   and the `http-server` dependency? Does `/bookshelf` hit the real PDS during local dev?
5. **TypeScript setup**: `tsconfig.json`, `@cloudflare/workers-types`, and whether `oxfmt` (the
   repo's existing formatter) handles `.ts` — check before assuming.
6. What happens to `package.json`'s scripts, and whether `node_modules` grows meaningfully.

## Provisional answer — decided by the implementation, not yet confirmed

- Layout: `public/` for assets (`index.html`, `style.css`, `hubot.woff2`, `404.html`),
  `src/` for the Worker, `wrangler.jsonc` and `tsconfig.json` at the root. `site/` is gone.
- The stylesheet is `/style.css`, **unhashed** — question 2 of this ticket is still open. It is
  cached by the asset layer, not by the Worker, so it does not share the shelf's year-long TTL,
  but the interaction has not been thought through.
- `@font-face` moved into `style.css` with everything else.
- `wrangler dev` replaces `http-server`; the `http-server` dependency is gone.
- TypeScript 7 with `@cloudflare/workers-types` v5, strict plus `noUncheckedIndexedAccess`.
  `oxfmt` formats `.ts` without extra configuration — verified.
- **Note for whoever works this ticket**: `.wrangler/state` persists the local Cache API between
  `wrangler dev` runs, so a stale render survives a code change and looks like a broken build.
  `rm -rf .wrangler` when the output stops matching the source.
