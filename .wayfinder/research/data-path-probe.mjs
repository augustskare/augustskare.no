// Proves the /bookshelf data path end to end, with no Cloudflare involved:
// DID -> PDS endpoint -> paginated listRecords -> filter -> group.
// Throwaway probe; the real thing goes in the Worker.

const DID = "did:plc:5zy6g7sxhhudcpyegms4l2n3";
const COLLECTION = "buzz.bookhive.book";
const FINISHED = "buzz.bookhive.defs#finished";
const READING = "buzz.bookhive.defs#reading";

async function resolvePds(did) {
  const doc = await fetch(`https://plc.directory/${did}`).then((r) => r.json());
  const svc = doc.service?.find((s) => s.type === "AtprotoPersonalDataServer");
  if (!svc) throw new Error("no PDS in DID document");
  return svc.serviceEndpoint;
}

async function listAll(pds, did, collection) {
  const out = [];
  let cursor;
  let pages = 0;
  do {
    const url = new URL("/xrpc/com.atproto.repo.listRecords", pds);
    url.searchParams.set("repo", did);
    url.searchParams.set("collection", collection);
    url.searchParams.set("limit", "100");
    if (cursor) url.searchParams.set("cursor", cursor);
    const res = await fetch(url);
    if (!res.ok) throw new Error(`listRecords ${res.status}`);
    const body = await res.json();
    out.push(...body.records);
    // The PDS returns a cursor even when the result set is exhausted, so stopping
    // only on a missing cursor costs an extra empty round trip. A short page is
    // the reliable end-of-collection signal.
    cursor = body.records.length < 100 ? undefined : body.cursor;
    pages++;
  } while (cursor);
  return { records: out, pages };
}

const started = Date.now();
const pds = await resolvePds(DID);
const { records, pages } = await listAll(pds, DID, COLLECTION);
const elapsed = Date.now() - started;

const reading = records.map((r) => r.value).filter((v) => v.status === READING);

const dropped = [];
const finished = records
  .map((r) => r.value)
  .filter((v) => {
    if (v.status !== FINISHED) return false;
    if (!v.finishedAt) {
      dropped.push(v.title);
      return false;
    }
    return true;
  })
  .sort((a, b) => b.finishedAt.localeCompare(a.finishedAt));

const years = new Map();
for (const v of finished) {
  const y = v.finishedAt.slice(0, 4);
  if (!years.has(y)) years.set(y, []);
  years.get(y).push(v);
}

console.log(`pds=${pds}`);
console.log(`fetched ${records.length} records in ${pages} page(s), ${elapsed}ms total\n`);
console.log("Reading now");
for (const v of reading) console.log(`  ${v.title} — ${v.authors}`);
for (const [year, books] of [...years].sort((a, b) => b[0].localeCompare(a[0]))) {
  console.log(`\n${year} (${books.length})`);
  for (const v of books) console.log(`  ${v.title} — ${v.authors}`);
}
console.log(`\ndropped (finished, no finishedAt): ${dropped.join(", ") || "none"}`);

// Escaping check: any title/author that would break naive string templating?
const needsEscaping = [...reading, ...finished].filter((v) =>
  /[<>&"]/.test(`${v.title}${v.authors}`),
);
console.log(
  `titles/authors containing <>&": ${needsEscaping.map((v) => v.title).join(" | ") || "none"}`,
);
