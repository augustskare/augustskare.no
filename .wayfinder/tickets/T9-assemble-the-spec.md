---
id: T9
title: Assemble the implementation-ready spec
type: task
status: open
assignee:
blocked-by: [T4, T5, T6, T7, T8]
---

## Question

The destination. Gather every closed ticket's resolution into one document an `/implement`
session can build from without needing to reopen any decision.

Invoke `/to-spec`.

Must contain:

1. The domain model and TypeScript types (T4).
2. The atproto read: DID resolution, `listRecords`, pagination, filtering, failure handling.
3. The page: markup and styles, from the prototype (T5).
4. The repo layout, `wrangler.jsonc`, and dev/deploy commands (T6).
5. The caching contract, stated as testable assertions (T7).
6. The cutover runbook as an appendix (T8).
7. An explicit **out of scope** list carried over from the map, so the implementer does not
   helpfully add a cron job or a nav link.

Done when someone could build the whole thing from this document alone.
