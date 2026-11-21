import { expect, test } from "vitest";
import { chipsFor, daysToPick, filterBook, pickFirstPage } from "../src/web/recipes/book.ts";

const salmon = { title: "Salmon", types: ["Fish" as const], tags: ["freezable", "kid-friendly"] };
const cod = { title: "Cod", types: ["Fish" as const], tags: ["kid-friendly"] };
const stew = { title: "Stew", types: ["Meat" as const], tags: ["freezable"] };
const curry = { title: "Curry", types: ["Chicken" as const], tags: ["freezable"] };
const book = [salmon, cod, stew, curry];

test("chips are the main types, then the book's tags with the most used first", () => {
  expect(chipsFor(book).map((chip) => chip.value)).toEqual(["Fish", "Meat", "Chicken", "Vegetarian", "Vegetables", "freezable", "kid-friendly"]);
});

test("filtering: any of the chosen types, all of the chosen tags", () => {
  expect(filterBook(book, [])).toEqual(book);
  expect(filterBook(book, [{ kind: "type", value: "Fish" }])).toEqual([salmon, cod]);
  expect(filterBook(book, [{ kind: "type", value: "Fish" }, { kind: "type", value: "Meat" }])).toEqual([salmon, cod, stew]);
  expect(filterBook(book, [{ kind: "tag", value: "freezable" }, { kind: "tag", value: "kid-friendly" }])).toEqual([salmon]);
  expect(filterBook(book, [{ kind: "type", value: "Fish" }, { kind: "tag", value: "freezable" }])).toEqual([salmon]);
});

test("add to week offers today to Sunday, then all of next week", () => {
  // 2026-11-18 is a Wednesday.
  const { thisWeek, nextWeek } = daysToPick("2026-11-18");
  expect(thisWeek).toEqual({ monday: "2026-11-16", dates: ["2026-11-18", "2026-11-19", "2026-11-20", "2026-11-21", "2026-11-22"] });
  expect(nextWeek.monday).toBe("2026-11-23");
  expect(nextWeek.dates).toHaveLength(7);
  expect(daysToPick("2026-11-22").thisWeek.dates).toEqual(["2026-11-22"]);
});

test("the book opens on a random page, never the one it opened on last time", () => {
  const pages = [{ id: "a" }, { id: "b" }, { id: "c" }];
  expect(pickFirstPage(pages, null, () => 0.99)).toBe(2);
  expect(pickFirstPage(pages, "a", () => 0)).toBe(1);
  expect(pickFirstPage(pages, "c", () => 0.99)).toBe(1);
  expect(pickFirstPage([{ id: "a" }], "a", () => 0.5)).toBe(0);
  expect(pickFirstPage([], "a", () => 0.5)).toBe(0);
});
