/**
 * Every page the site serves. Both pages go through the same `page()` shell, so
 * the head, the stylesheet link and the document structure exist in one place and
 * a change to either is a change to both.
 *
 * Interpolation is escaped by the `html` tag, which matters for the shelf: every
 * title and author in it came off the PDS and is untrusted.
 */

import { html, type SafeHtml } from "remix/html-template";

import type { Entry, Shelf } from "./shelf";

const NAME = "August Skare";

function page(title: string, header: SafeHtml, main: SafeHtml): SafeHtml {
  return html`<!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="color-scheme" content="light dark" />
        <title>${title}</title>
        <link rel="stylesheet" href="/style.css" />
      </head>
      <body>
        <header>${header}</header>
        <main>${main}</main>
      </body>
    </html> `;
}

export function renderHome(): SafeHtml {
  return page(
    NAME,
    html`
      <h1>${NAME}</h1>
      <p>Frontend developer, living in Tromsø, Norway.</p>
    `,
    html`
      <section>
        <h2>About</h2>
        <p>
          Making energy-consuming devices talk to each other at
          <a class="enode" href="https://enode.com">Enode</a>.
        </p>
      </section>

      <section>
        <h2>Work experience</h2>
        <ol reversed="reversed">
          <li class="enode">
            <article>
              <h3><a href="https://enode.com">Enode</a> <small>Present</small></h3>
              <p>
                <em>Senior software engineer</em>, from
                <time datetime="2021-09">September 2021</time>
                to present
              </p>
            </article>
          </li>
          <li class="bb">
            <article>
              <h3>
                <a href="https://bakkenbaeck.com">Bakken & Bæck</a>
                <small>April 2013 - September 2021</small>
              </h3>
              <ol reversed="reversed">
                <li>
                  <em>Frontend lead</em>, from
                  <time datetime="2018-05">May 2018</time>
                  to
                  <time datetime="2021-09">September 2021</time>
                </li>
                <li>
                  <em>Frontend developer</em>, from
                  <time datetime="2013-04">April 2013</time>
                  to
                  <time datetime="2018-05">May 2018</time>
                </li>
              </ol>
            </article>
          </li>
        </ol>
      </section>

      <section>
        <h2>Education</h2>
        <ol>
          <li>
            <em>Bachelor of Science in Computer Science</em> at Norwegian School of Information
            Technology, from
            <time datetime="2013-04">April 2013</time>
            to
            <time datetime="2018-05">May 2018</time>
          </li>
        </ol>
      </section>

      <section>
        <h2>Contact</h2>
        <address>
          <ul>
            <li><a href="https://github.com/augustskare">GitHub</a></li>
            <li><a href="mailto:post@augustskare.no">Email</a></li>
          </ul>
        </address>
      </section>
    `,
  );
}

/** The shelf pages share a header: the site name links home, the h1 names the page. */
function shelfPage(main: SafeHtml): SafeHtml {
  return page(
    `Bookshelf — ${NAME}`,
    html`
      <a href="/">${NAME}</a>
      <h1>Bookshelf</h1>
    `,
    main,
  );
}

function items(books: Entry[]): SafeHtml[] {
  return books.map((book) => html`<li>${book.title} <small>${book.author}</small></li>`);
}

export function renderShelf(shelf: Shelf): SafeHtml {
  const sections: SafeHtml[] = [];

  // Unordered: two books being read at once are not in any sequence. The year
  // lists below are reversed, matching the work-experience list on the homepage.
  if (shelf.reading.length > 0) {
    sections.push(html`
      <section>
        <h2>Reading now</h2>
        <ul>
          ${items(shelf.reading)}
        </ul>
      </section>
    `);
  }

  for (const group of shelf.years) {
    sections.push(html`
      <section>
        <h2>${group.year}</h2>
        <ol reversed="reversed">
          ${items(group.books)}
        </ol>
      </section>
    `);
  }

  if (sections.length === 0) {
    sections.push(html`<p>Nothing on the shelf.</p>`);
  }

  return shelfPage(html`${sections}`);
}

export function renderUnavailable(): SafeHtml {
  return shelfPage(html`
    <p>
      The shelf could not be loaded right now — the books live in my
      <a href="https://atproto.com">atproto</a> repository, and it did not answer. Try again in a
      bit.
    </p>
  `);
}
