---
id: T4
title: Domain model and TypeScript types for the shelf
type: grilling
status: open
assignee:
blocked-by: []
---

## Question

Pin the vocabulary and the types that sit between the raw atproto records and the rendered page,
so the render code never touches `buzz.bookhive.defs#…` strings directly.

Invoke `/domain-modeling` and `/grilling`.

Known facts about the source data (58 records, sampled 2026-08-09):

- Every record has `title`, `authors` (a single plain string, never a list or delimiter-joined),
  `owned`, `createdAt`, `hiveId`, `identifiers.goodreadsId`, `status`.
- `status` is one of `buzz.bookhive.defs#finished` (39), `#wantToRead` (17), `#reading` (2).
- `finishedAt` on 38; `cover` on 57; `stars` on 9; `hiveBookUri` on 32; `startedAt` and
  `bookProgress` on 1 each.
- `createdAt` is worthless as a date signal — all 58 records were imported on 2026-08-08.

Decide:

1. The domain terms. Is the thing on the page a _Book_, a _Reading_, a _Shelf entry_? What is the
   group heading called — a _year_, a _shelf_, a _section_? Name "Reading now" once and for all.
2. The **shape after parsing**: what a finished entry carries vs a currently-reading entry.
   Modelled as a discriminated union on status, or one type with optionals?
3. The **omission rule** as a typed operation: `finished` without `finishedAt` is dropped
   (currently exactly one book, _Ut og stjæle hester_). Where does that filter live, and is a
   dropped record silent or surfaced somehow?
4. How much of the record is **validated vs trusted**. The PDS returns whatever is in the repo;
   a missing `title` or an unrecognised `status` string is possible. Does an unparseable record
   drop out, or fail the render?
5. Which fields are **deliberately discarded** — `cover`, `stars`, `owned`, `identifiers`,
   `hiveBookUri`, `wantToRead` entries — recorded so a future reader knows it was a choice, not
   an oversight.
6. Grouping and ordering as domain rules: years descending, newest `finishedAt` first within a
   year, "Reading now" above all years.

Produces the type definitions and parsing rules the prototype (T5) renders from.

## Provisional answer — decided by the implementation, not yet confirmed

Implemented in `src/shelf.ts` ahead of this ticket being worked. Open for revision.

- Terms: an **Entry** (title + author) on a **Shelf**, grouped into **YearGroup**s, plus
  `reading`. "Reading now" is the heading.
- One `Entry` type, not a discriminated union — a finished entry and a reading entry carry exactly
  the same two fields once the date has been used for grouping, so the union had no payload.
- Unparseable records **drop silently**: a missing/blank/non-string title or author, an
  unrecognised status, or a `finishedAt` with no leading year. The render never fails on bad data.
- `finishedAt` is kept as a timestamp through sorting and the year is derived at grouping time.
- Discarded, deliberately: `cover`, `stars`, `owned`, `identifiers`, `hiveBookUri`, `startedAt`,
  `bookProgress`, and every `wantToRead` record.
