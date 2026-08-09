import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "./index";
import { STATUS_FINISHED } from "./shelf";

const ctx = {
  waitUntil: () => {},
  passThroughOnException: () => {},
} as unknown as ExecutionContext;

/**
 * Stands in for the real Cache API, including its refusal to `put()` anything
 * that is not a GET — the constraint that made a HEAD request throw.
 */
function stubCache(hit?: Response) {
  const put = vi.fn(async (request: Request) => {
    if (request.method !== "GET") throw new TypeError("Cannot cache a non-GET request");
  });
  const match = vi.fn(async (_request: Request) => hit);
  vi.stubGlobal("caches", { default: { match, put } });
  return { put, match };
}

/** Enough of plc.directory + listRecords to get through a render. */
function stubAtproto(books: unknown[]) {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: string | URL) => {
      const url = String(input);
      if (url.startsWith("https://plc.directory/")) {
        return Response.json({
          service: [{ type: "AtprotoPersonalDataServer", serviceEndpoint: "https://pds.example" }],
        });
      }
      return Response.json({ records: books.map((value) => ({ value })) });
    }),
  );
}

const get = (path = "/bookshelf") => new Request(`https://augustskare.no${path}`);

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("worker", () => {
  it("renders and caches the shelf", async () => {
    const { put } = stubCache();
    stubAtproto([
      {
        status: STATUS_FINISHED,
        title: "Doppler",
        authors: "Erlend Loe",
        finishedAt: "2023-01-01",
      },
    ]);

    const response = await worker.fetch(get(), {}, ctx);

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("public, max-age=60, s-maxage=31536000");
    expect(await response.text()).toContain("Doppler");
    expect(put).toHaveBeenCalledOnce();
  });

  it("serves a cache hit without touching the network", async () => {
    stubCache(new Response("cached", { status: 200 }));
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const response = await worker.fetch(get(), {}, ctx);

    expect(await response.text()).toBe("cached");
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("never caches the failure page", async () => {
    const { put } = stubCache();
    vi.stubGlobal("fetch", async () => new Response("nope", { status: 500 }));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await worker.fetch(get(), {}, ctx);

    // With no stored copy to fall back on, caching this would pin an error page
    // to the edge until someone purged by hand.
    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(put).not.toHaveBeenCalled();
  });

  it("caches a HEAD request under a GET key instead of throwing", async () => {
    const { put } = stubCache();
    stubAtproto([]);

    const response = await worker.fetch(
      new Request("https://augustskare.no/bookshelf", { method: "HEAD" }),
      {},
      ctx,
    );

    // The Cache API rejects put() for non-GET requests, so the key has to be
    // normalised or every HEAD miss throws inside waitUntil.
    expect(response.status).toBe(200);
    expect(put).toHaveBeenCalledOnce();
    await expect(put.mock.results[0]?.value).resolves.toBeUndefined();
    expect(put.mock.calls[0]?.[0].method).toBe("GET");
  });

  it("collapses query strings onto one cache entry", async () => {
    const { put, match } = stubCache();
    stubAtproto([]);

    await worker.fetch(get("/bookshelf?utm_source=whatever"), {}, ctx);

    // Otherwise any visitor could mint unlimited cache misses, each one a fresh
    // crawl of the PDS.
    expect(match.mock.calls[0]?.[0].url).toBe("https://augustskare.no/bookshelf");
    expect(put.mock.calls[0]?.[0].url).toBe("https://augustskare.no/bookshelf");
  });

  it("rejects non-GET methods", async () => {
    stubCache();
    const response = await worker.fetch(
      new Request("https://augustskare.no/bookshelf", { method: "POST" }),
      {},
      ctx,
    );

    expect(response.status).toBe(405);
  });

  it("404s anything that is not the shelf", async () => {
    stubCache();
    const response = await worker.fetch(get("/elsewhere"), {}, ctx);

    expect(response.status).toBe(404);
  });
});
