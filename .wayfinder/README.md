# Wayfinder tracker (local markdown)

The map is `map.md` (label `wayfinder:map`). Its tickets are the files in `tickets/`.

## Conventions

- **Ticket file**: `tickets/<id>-<slug>.md`, frontmatter + a `## Question` body.
- **Identity** is the `id` field (`T1`, `T2`, …). Always refer to a ticket by its **title** in
  anything a human reads — never a bare id.
- **Claim** a ticket by setting `assignee` before doing any work, so concurrent sessions skip it.
  An `open` ticket with an empty `assignee` is unclaimed.
- **Blocking** is the `blocked-by` list (ids). A ticket is unblocked when every id in it is `closed`.
- **Frontier** = tickets that are `open`, unblocked, and unassigned.
- **Resolution**: append a `## Resolution` section to the ticket, set `status: closed`, and add a
  one-line pointer to `map.md` under Decisions so far.
- **Assets** produced while resolving a ticket are linked from the ticket, not pasted into it.

## Frontier query

```sh
grep -L "^status: closed" .wayfinder/tickets/*.md | xargs grep -l "^assignee: *$"
# then check each candidate's blocked-by ids are all closed
```
