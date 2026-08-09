/**
 * Rendering the bookshelf page. Matches the markup vocabulary of index.html:
 * sections with an h2, reverse-chronological lists, <small> for the secondary bit.
 */

import type { Entry, Shelf } from "./shelf";

const TITLE = "Bookshelf — August Skare";

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function page(main: string): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="color-scheme" content="light dark" />
    <title>${escapeHtml(TITLE)}</title>
    <link rel="stylesheet" href="/style.css" />
  </head>
  <body>
    <header>
      <h1>Bookshelf</h1>
      <p><a href="/">August Skare</a></p>
    </header>
    <main>
${main}
    </main>
  </body>
</html>
`;
}

function items(books: Entry[]): string {
  return books
    .map(
      (book) =>
        `          <li>${escapeHtml(book.title)} <small class="shelf-author">${escapeHtml(
          book.author,
        )}</small></li>`,
    )
    .join("\n");
}

export function renderShelf(shelf: Shelf): string {
  const sections: string[] = [];

  // Unordered: two books being read at once are not in any sequence. The year
  // lists below are reversed, matching the work-experience list on the homepage.
  if (shelf.reading.length > 0) {
    sections.push(`      <section>
        <h2>Reading now</h2>
        <ul>
${items(shelf.reading)}
        </ul>
      </section>`);
  }

  for (const group of shelf.years) {
    sections.push(`      <section>
        <h2 class="shelf-year">${escapeHtml(group.year)}</h2>
        <ol reversed="reversed">
${items(group.books)}
        </ol>
      </section>`);
  }

  if (sections.length === 0) {
    sections.push("      <p>Nothing on the shelf.</p>");
  }

  return page(sections.join("\n"));
}

export function renderUnavailable(): string {
  return page(
    `      <p>
        The shelf could not be loaded right now — the books live in my
        <a href="https://atproto.com">atproto</a> repository, and it did not answer.
        Try again in a bit.
      </p>`,
  );
}
