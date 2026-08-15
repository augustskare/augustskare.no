import { describe, expect, it } from "vitest";
import { renderHome, renderShelf } from "./render";
import { STATUS_FINISHED, toShelf } from "./shelf";

const finished = (title: string, authors: string, finishedAt: string) => ({
  status: STATUS_FINISHED,
  title,
  authors,
  finishedAt,
});

/** The templates return SafeHtml, which is a String object rather than a string. */
const shelf = (...records: Parameters<typeof toShelf>[0]) => String(renderShelf(toShelf(records)));

describe("renderHome", () => {
  it("keeps the markup the asset-served page had", () => {
    const html = String(renderHome());

    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("<title>August Skare</title>");
    expect(html).toContain('<link rel="stylesheet" href="/style.css" />');
    expect(html).toContain("Work experience");
    // Static template text is passed through as written — only interpolations are
    // escaped — so this reads exactly as it did in index.html.
    expect(html).toContain("Bakken & Bæck");
  });
});

describe("renderShelf", () => {
  it("escapes titles and authors coming off the PDS", () => {
    const html = shelf(
      finished('<script>alert("x")</script>', "A & B", "2025-01-01T00:00:00.000Z"),
    );

    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("A &amp; B");
  });

  it("omits the reading section entirely when nothing is being read", () => {
    const html = shelf(finished("T", "A", "2025-01-01T00:00:00.000Z"));

    expect(html).not.toContain("Reading now");
    expect(html).toContain("2025");
  });

  it("numbers the year lists in reverse but leaves reading-now unordered", () => {
    const html = shelf(
      { status: "buzz.bookhive.defs#reading", title: "Now", authors: "A" },
      finished("Done", "B", "2025-01-01T00:00:00.000Z"),
    );

    expect(html).toMatch(/<h2>Reading now<\/h2>\s*<ul>/);
    expect(html).toContain('<ol reversed="reversed">');
  });

  it("says so when the shelf is empty", () => {
    expect(String(renderShelf({ reading: [], years: [] }))).toContain("Nothing on the shelf.");
  });
});
