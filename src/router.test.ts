import { afterEach, describe, expect, it, vi } from "vitest";
import { router, SHELF_CACHE_CONTROL } from "./router";
import { STATUS_FINISHED } from "./shelf";

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

afterEach(() => {
  vi.unstubAllGlobals();
});

// No Cache API, no ExecutionContext, no bindings: the router is reachable with a
// bare Request, which is the point of keeping Cloudflare out of it.
describe("router", () => {
  it("renders the shelf", async () => {
    stubAtproto([
      {
        status: STATUS_FINISHED,
        title: "Doppler",
        authors: "Erlend Loe",
        finishedAt: "2023-01-01",
      },
    ]);

    const response = await router.fetch("https://augustskare.no/bookshelf");

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
    expect(await response.text()).toContain("Doppler");
  });

  // The header is the whole caching mechanism, so it is worth asserting verbatim.
  it("asks shared caches to keep the shelf and browsers to recheck it", async () => {
    stubAtproto([]);

    const response = await router.fetch("https://augustskare.no/bookshelf");

    expect(response.headers.get("cache-control")).toBe(SHELF_CACHE_CONTROL);
    expect(SHELF_CACHE_CONTROL).toBe("public, max-age=60, s-maxage=31536000");
    expect(response.headers.get("cache-tag")).toBe("bookshelf");
  });

  it("never lets the failure page be cached", async () => {
    vi.stubGlobal("fetch", async () => new Response("nope", { status: 500 }));
    vi.spyOn(console, "error").mockImplementation(() => {});

    const response = await router.fetch("https://augustskare.no/bookshelf");

    expect(response.status).toBe(503);
    expect(response.headers.get("cache-control")).toBe("no-store");
  });

  // The route is declared with get(), so a POST matches nothing at all. Remix's
  // router has no notion of 405 — the hand-rolled version's 405 + Allow would have
  // to come back as middleware if it is wanted.
  it("does not answer a wrong method", async () => {
    const response = await router.fetch("https://augustskare.no/bookshelf", { method: "POST" });

    expect(response.status).toBe(404);
  });

  it("404s a path it has no route for", async () => {
    const response = await router.fetch("https://augustskare.no/elsewhere");

    expect(response.status).toBe(404);
  });
});
