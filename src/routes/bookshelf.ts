import { html } from "remix/html-template";
import { layout } from "../utils/layout";

export default function bookshelf(
  collections: { title: string; books: { title: string; author: string }[] }[],
) {
  return layout(
    html`
      <a href="/" class="title">August Skare</a>
      <h1>Bookshelf</h1>
      ${collections.map((collection) => {
        return html`
          <section>
            <h2>${collection.title}</h2>
            <ol reversed="reversed">
              ${collection.books.map((book) => html`<li>${book.title} <small>${book.author}</small></li>`)}
            </ol>
          </section>
        `;
      })}
    `,
    "Bookself",
  );
}
