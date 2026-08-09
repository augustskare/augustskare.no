---
id: T5
title: Prototype the bookshelf page and its error state
type: prototype
status: open
assignee:
blocked-by: [T4]
---

## Question

What does `/bookshelf` actually look like? Build it as a static HTML file with the real 38+2
books hardcoded, so there is something concrete to react to before any Worker exists.

Invoke `/prototype`. Link the resulting file from this ticket.

Settled already, do not relitigate:

- A "Reading now" group on top, then years descending: 2026 (8), 2025 (12), 2024 (9), 2023 (9).
- An `<ol>` per year under a year heading, newest-finished first, mirroring the `<ol reversed>`
  pattern already used for work experience in `site/index.html`.
- Title and author as plain text. No covers, no ratings, no links, no want-to-read list.

Open:

1. The **markup** for a single entry. Title and author in what elements — is the author a
   `<small>`, an `<em>`, a separate line? The existing `index.html` uses `<h3>` + `<small>` for
   job entries and `<em>` for role names; match that vocabulary.
2. **Density**. 40 entries in a list is a long page. Does it need columns, tighter leading, or is
   a plain long scroll right for the site's character?
3. The **year heading** level and whether it carries a count.
4. The **page header** — does `/bookshelf` repeat the `<h1>August Skare</h1>` masthead, or lead
   with its own title? There is no nav (ruled out of scope), so the page needs to establish where
   it is on its own.
5. The **error state** from the destination grilling: on a cache miss with the PDS unreachable,
   the page renders with its chrome intact and an error in place of the list. What does that say,
   and does it offer anything (a link to the BookHive profile)?
6. Whether any new CSS is needed at all beyond what `index.html` already has, given the shared
   stylesheet extraction.

## Provisional answer — decided by the implementation, not yet confirmed

Built directly in `src/render.ts` rather than as a throwaway prototype. Open for revision.

- Entry markup: `<li>Title <small class="shelf-author">Author</small></li>`, borrowing the
  `<small>`-for-secondary-text idiom from the work-experience list on the homepage.
- "Reading now" is a `<ul>` — two books read at once are not a sequence. Year lists are
  `<ol reversed="reversed">`, matching the homepage.
- Own masthead: `<h1>Bookshelf</h1>` with a back-link to `/`, since there is no nav.
- New CSS is two rules (`.shelf-year`, `.shelf-author`), both just `--mauve11` for secondary text.
- Error copy links `atproto.com` rather than a BookHive profile. **Least confident choice here** —
  a reader hitting the error page probably wants the books, not a protocol homepage.
