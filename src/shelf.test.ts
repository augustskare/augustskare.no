import { describe, expect, it } from "vitest";
import { STATUS_FINISHED, STATUS_READING, toShelf } from "./shelf";

const finished = (title: string, authors: string, finishedAt: string) => ({
  status: STATUS_FINISHED,
  title,
  authors,
  finishedAt,
});

const reading = (title: string, authors: string) => ({
  status: STATUS_READING,
  title,
  authors,
});

describe("toShelf", () => {
  it("groups finished books by year, newest year first", () => {
    const shelf = toShelf([
      finished("Doppler", "Erlend Loe", "2023-04-01T00:00:00.000Z"),
      finished("1984", "George Orwell", "2026-02-01T00:00:00.000Z"),
      finished("Victoria", "Knut Hamsun", "2024-06-01T00:00:00.000Z"),
    ]);

    expect(shelf.years.map((group) => group.year)).toEqual(["2026", "2024", "2023"]);
  });

  it("orders books within a year by most recently finished", () => {
    const shelf = toShelf([
      finished("January", "A", "2025-01-05T00:00:00.000Z"),
      finished("December", "B", "2025-12-20T00:00:00.000Z"),
      finished("June", "C", "2025-06-10T00:00:00.000Z"),
    ]);

    expect(shelf.years[0]?.books.map((book) => book.title)).toEqual([
      "December",
      "June",
      "January",
    ]);
  });

  it("drops a finished book with no finishedAt rather than guessing its year", () => {
    const shelf = toShelf([
      { status: STATUS_FINISHED, title: "Ut og stjæle hester", authors: "Per Petterson" },
      finished("Bikubesong", "Frode Grytten", "2025-03-01T00:00:00.000Z"),
    ]);

    expect(shelf.years.flatMap((group) => group.books.map((book) => book.title))).toEqual([
      "Bikubesong",
    ]);
  });

  it("keeps currently-reading books separate and does not require a date", () => {
    const shelf = toShelf([
      reading("All the Lovers in the Night", "Mieko Kawakami"),
      finished("Havboka", "Morten A. Strøksnes", "2023-09-01T00:00:00.000Z"),
    ]);

    expect(shelf.reading.map((book) => book.title)).toEqual(["All the Lovers in the Night"]);
    expect(shelf.years).toHaveLength(1);
  });

  it("ignores want-to-read books", () => {
    const shelf = toShelf([
      { status: "buzz.bookhive.defs#wantToRead", title: "Ufred", authors: "Åsne Seierstad" },
    ]);

    expect(shelf).toEqual({ reading: [], years: [] });
  });

  it("skips records missing a title or author instead of rendering blanks", () => {
    const shelf = toShelf([
      { status: STATUS_READING, title: "   ", authors: "Someone" },
      { status: STATUS_READING, title: "A book", authors: undefined },
      { status: STATUS_FINISHED, title: 42, authors: "X", finishedAt: "2025-01-01T00:00:00.000Z" },
    ]);

    expect(shelf).toEqual({ reading: [], years: [] });
  });

  it("rejects a finishedAt that is not a usable year", () => {
    const shelf = toShelf([{ status: STATUS_FINISHED, title: "T", authors: "A", finishedAt: "" }]);

    expect(shelf.years).toEqual([]);
  });
});
