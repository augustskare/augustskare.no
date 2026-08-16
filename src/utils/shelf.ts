/**
 * The shelf domain: turning raw `buzz.bookhive.book` records into the two things
 * the page shows — what I am reading now, and what I finished, by year.
 *
 * Everything here is pure. The network lives in atproto.ts.
 */

export const STATUS_FINISHED = "buzz.bookhive.defs#finished";
export const STATUS_READING = "buzz.bookhive.defs#reading";

/** A record as it comes off the PDS. Every field is untrusted. */
export interface BookRecord {
  $type?: string;
  title?: unknown;
  authors?: unknown;
  status?: unknown;
  finishedAt?: unknown;
}

export interface Entry {
  title: string;
  author: string;
}

export interface YearGroup {
  year: string;
  books: Entry[];
}

export interface Shelf {
  reading: Entry[];
  years: YearGroup[];
}

function text(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function entry(record: BookRecord): Entry | null {
  const title = text(record.title);
  const author = text(record.authors);
  if (!title || !author) return null;
  return { title, author };
}

/**
 * A finished book without a usable `finishedAt` is dropped rather than guessed
 * at — `createdAt` is no help, since the whole collection was imported on a
 * single day. Only the leading year is ever read, so that is all that is checked.
 */
function finishedTimestamp(record: BookRecord): string | null {
  const finishedAt = text(record.finishedAt);
  if (!finishedAt) return null;
  return /^\d{4}/.test(finishedAt) ? finishedAt : null;
}

/** Newest first, for ISO timestamps and four-digit years alike. */
function descending(a: string, b: string): number {
  return a < b ? 1 : a > b ? -1 : 0;
}

export function toShelf(records: BookRecord[]): Shelf {
  const reading: Entry[] = [];
  const finished: { entry: Entry; finishedAt: string }[] = [];

  for (const record of records) {
    const parsed = entry(record);
    if (!parsed) continue;

    if (record.status === STATUS_READING) {
      reading.push(parsed);
      continue;
    }

    if (record.status === STATUS_FINISHED) {
      const finishedAt = finishedTimestamp(record);
      if (!finishedAt) continue;
      finished.push({ entry: parsed, finishedAt });
    }
  }

  // ISO timestamps sort correctly as plain strings.
  finished.sort((a, b) => descending(a.finishedAt, b.finishedAt));

  const byYear = new Map<string, Entry[]>();
  for (const book of finished) {
    const year = book.finishedAt.slice(0, 4);
    const books = byYear.get(year);
    if (books) books.push(book.entry);
    else byYear.set(year, [book.entry]);
  }

  const years = [...byYear]
    .sort((a, b) => descending(a[0], b[0]))
    .map(([year, books]) => ({ year, books }));

  return { reading, years };
}
