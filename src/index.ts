import { createHtmlResponse } from "remix/response/html";
import type { SafeHtml } from "remix/html-template";
import { createRouter } from "remix/router";

import { fetchBookRecords } from "./utils/atproto";
import { toShelf } from "./utils/shelf";
import { route, get } from "remix/routes";

import home from "./routes/home";
import bookshelf from "./routes/bookshelf";

export const routes = route({
  home: get("/"),
  bookshelf: get("/bookshelf"),
});

export const router = createRouter();

router.map(routes, {
  actions: {
    home: () => htmlResponse(home),
    bookshelf: async () => {
      const shelf = toShelf(await fetchBookRecords());
      return htmlResponse(
        bookshelf([
          { title: "Currently reading", books: shelf.reading },
          ...shelf.years.map((e) => ({ title: e.year, books: e.books })),
        ]),
      );
    },
  },
});

function htmlResponse(body: SafeHtml) {
  return createHtmlResponse(body, {
    headers: { "cache-control": "public, max-age=60, s-maxage=31536000" },
  });
}

export default {
  fetch(request: Request): Promise<Response> {
    return router.fetch(request);
  },
};
