import { describe, expect, it } from "vitest";
import { escapeHtml, renderShelf } from "./render";
import { STATUS_FINISHED, toShelf } from "./shelf";

const finished = (title: string, authors: string, finishedAt: string) => ({
  status: STATUS_FINISHED,
  title,
  authors,
  finishedAt,
});

describe("escapeHtml", () => {
  it("escapes characters that would break out of markup", () => {
    expect(escapeHtml(`Tom & Jerry <script> "x" 'y'`)).toBe(
      "Tom &amp; Jerry &lt;script&gt; &quot;x&quot; &#39;y&#39;",
    );
  });
});

describe("renderShelf", () => {
  it("escapes titles and authors coming off the PDS", () => {
    const html = renderShelf(
      toShelf([finished('<script>alert("x")</script>', "A & B", "2025-01-01T00:00:00.000Z")]),
    );

    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("A &amp; B");
  });

  it("omits the reading section entirely when nothing is being read", () => {
    const html = renderShelf(toShelf([finished("T", "A", "2025-01-01T00:00:00.000Z")]));

    expect(html).not.toContain("Reading now");
    expect(html).toContain("2025");
  });

  it("numbers the year lists in reverse but leaves reading-now unordered", () => {
    const html = renderShelf(
      toShelf([
        { status: "buzz.bookhive.defs#reading", title: "Now", authors: "A" },
        finished("Done", "B", "2025-01-01T00:00:00.000Z"),
      ]),
    );

    expect(html).toMatch(/<h2>Reading now<\/h2>\s*<ul>/);
    expect(html).toContain('<ol reversed="reversed">');
  });

  it("says so when the shelf is empty", () => {
    expect(renderShelf({ reading: [], years: [] })).toContain("Nothing on the shelf.");
  });
});
