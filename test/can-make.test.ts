import { expect, test } from "vitest";
import { parseHave } from "../src/server/web-ideas.ts";

test("the ingredients you have are trimmed, and 1 to 30 short names are allowed", () => {
  expect(parseHave({ have: [" carrots ", "Butter"] })).toEqual(["carrots", "Butter"]);
  expect(parseHave({ have: Array.from({ length: 30 }, (_, index) => `item ${index}`) })).toHaveLength(30);
  expect(parseHave({ have: Array.from({ length: 31 }, (_, index) => `item ${index}`) })).toEqual({ error: "List 1 to 30 ingredients you have." });
});

test("an empty list, a blank name, a long name or a non-text name are refused", () => {
  expect(parseHave({ have: [] })).toEqual({ error: "List 1 to 30 ingredients you have." });
  expect(parseHave({ have: ["  "] })).toEqual({ error: "Every ingredient needs a name." });
  expect(parseHave({ have: ["x".repeat(81)] })).toEqual({ error: "Keep each ingredient name short." });
  expect(parseHave({ have: ["x", "y", "z", 1] })).toEqual({ error: "Every ingredient needs a name." });
  expect(parseHave(undefined)).toEqual({ error: "List 1 to 30 ingredients you have." });
});
