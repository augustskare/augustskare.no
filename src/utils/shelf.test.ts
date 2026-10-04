import { expect, test } from "vitest";
import { STATUS_FINISHED, STATUS_READING, toShelf, type BookRecord } from "./shelf";

function record(fields: Partial<BookRecord>): BookRecord {
  return { $type: "buzz.bookhive.book", authors: "An Author", ...fields };
}

test("keeps books that are being read", () => {
  const shelf = toShelf([
    record({ title: "In progress", authors: "Someone", status: STATUS_READING }),
  ]);

  expect(shelf.reading).toEqual([{ title: "In progress", author: "Someone" }]);
  expect(shelf.years).toEqual([]);
});

test("groups finished books by year, newest first", () => {
  const shelf = toShelf([
    record({ title: "Older", status: STATUS_FINISHED, finishedAt: "2024-06-01T00:00:00Z" }),
    record({ title: "Newest", status: STATUS_FINISHED, finishedAt: "2025-11-02T00:00:00Z" }),
    record({
      title: "Same year, earlier",
      status: STATUS_FINISHED,
      finishedAt: "2025-01-09T00:00:00Z",
    }),
  ]);

  expect(shelf.years).toEqual([
    {
      year: "2025",
      books: [
        { title: "Newest", author: "An Author" },
        { title: "Same year, earlier", author: "An Author" },
      ],
    },
    { year: "2024", books: [{ title: "Older", author: "An Author" }] },
  ]);
});

test("drops books that are neither finished nor being read", () => {
  const shelf = toShelf([
    record({ title: "Someday", status: "buzz.bookhive.defs#wantToRead" }),
    record({ title: "Gave up", status: "buzz.bookhive.defs#abandoned" }),
    record({ title: "No status at all" }),
  ]);

  expect(shelf).toEqual({ reading: [], years: [] });
});

test("drops a finished book with no usable finish date", () => {
  const shelf = toShelf([
    record({ title: "When?", status: STATUS_FINISHED }),
    record({ title: "Blank", status: STATUS_FINISHED, finishedAt: "   " }),
    record({ title: "Not a date", status: STATUS_FINISHED, finishedAt: "sometime" }),
    record({ title: "Wrong type", status: STATUS_FINISHED, finishedAt: 2025 }),
  ]);

  expect(shelf.years).toEqual([]);
});

test("drops records with a missing or blank title or author", () => {
  const shelf = toShelf([
    record({ status: STATUS_READING }),
    record({ title: "", status: STATUS_READING }),
    record({ title: "   ", status: STATUS_READING }),
    record({ title: "Untitled author", authors: "", status: STATUS_READING }),
    record({ title: "Numeric title", authors: 42, status: STATUS_READING }),
  ]);

  expect(shelf.reading).toEqual([]);
});

test("trims whitespace around title and author", () => {
  const shelf = toShelf([
    record({ title: "  Padded  ", authors: "  Someone ", status: STATUS_READING }),
  ]);

  expect(shelf.reading).toEqual([{ title: "Padded", author: "Someone" }]);
});
