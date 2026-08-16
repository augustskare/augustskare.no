/**
 * Reading the book records straight out of my atproto repo. No auth, no SDK —
 * `listRecords` is public.
 */

import type { BookRecord } from "./utils/shelf";

const DID = "did:plc:5zy6g7sxhhudcpyegms4l2n3";
const COLLECTION = "buzz.bookhive.book";
const PAGE_SIZE = 100;

interface DidDocument {
  service?: { id?: string; type?: string; serviceEndpoint?: string }[];
}

interface ListRecordsResponse {
  records?: { value?: BookRecord }[];
  cursor?: string;
}

async function json<T>(url: string | URL, operation: string): Promise<T> {
  const response = await fetch(url, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`${operation}: ${response.status} ${response.statusText}`);
  return (await response.json()) as T;
}

/**
 * The PDS hostname is not hardcoded because it changes if I ever migrate hosts —
 * the DID document is the source of truth.
 */
async function resolvePds(did: string): Promise<string> {
  const doc = await json<DidDocument>(`https://plc.directory/${did}`, "resolve DID");
  const pds = doc.service?.find((s) => s.type === "AtprotoPersonalDataServer")?.serviceEndpoint;
  if (!pds) throw new Error("DID document has no PDS endpoint");
  return pds;
}

export async function fetchBookRecords(): Promise<BookRecord[]> {
  const pds = await resolvePds(DID);
  const records: BookRecord[] = [];
  let cursor: string | undefined;

  do {
    const url = new URL("/xrpc/com.atproto.repo.listRecords", pds);
    url.searchParams.set("repo", DID);
    url.searchParams.set("collection", COLLECTION);
    url.searchParams.set("limit", String(PAGE_SIZE));
    if (cursor) url.searchParams.set("cursor", cursor);

    const page = await json<ListRecordsResponse>(url, "listRecords");
    for (const record of page.records ?? []) {
      if (record.value) records.push(record.value);
    }

    // The PDS returns a cursor even when the collection is exhausted, so stopping
    // on a missing cursor costs an extra empty round trip on every render. A short
    // page is the reliable end signal.
    cursor = (page.records?.length ?? 0) < PAGE_SIZE ? undefined : page.cursor;
  } while (cursor);

  return records;
}
