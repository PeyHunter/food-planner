import { expect, test } from "vitest";
import { kitchenConfigs, readKitchens } from "../src/server/kitchens-config.ts";

const home = { PEYTON_PASSWORD: "a", RONJA_PASSWORD: "b" };

test("only the home kitchen is made while no other passwords are set", () => {
  expect(readKitchens(home)).toEqual([
    { name: "Our kitchen", kids: ["Runi Lee"], language: "en", starter: false, people: [{ username: "peyton", password: "a" }, { username: "ronja", password: "b" }] },
  ]);
});

test("the home kitchen's passwords must be set", () => {
  expect(readKitchens({ PEYTON_PASSWORD: "a" })).toEqual({ error: "PEYTON_PASSWORD and RONJA_PASSWORD must all be set. They are the starting passwords for the logins." });
});

test("valdemar and anna get a Danish kitchen with Vilje and Konrad and starter recipes", () => {
  const ready = readKitchens({ ...home, VALDEMAR_PASSWORD: "c", ANNA_PASSWORD: "d" });
  expect(ready).toContainEqual({
    name: "Valdemar og Annas køkken",
    kids: ["Vilje", "Konrad"],
    language: "da",
    starter: true,
    people: [{ username: "valdemar", password: "c" }, { username: "anna", password: "d" }],
  });
});

test("a kitchen with only some of its passwords set is an error", () => {
  expect(readKitchens({ ...home, VALDEMAR_PASSWORD: "c" })).toEqual({ error: "Set all of VALDEMAR_PASSWORD, ANNA_PASSWORD, or none." });
});

test("kid-free kitchens stay kid-free and English", () => {
  const ready = readKitchens({ ...home, MARIEKE_PASSWORD: "m" });
  expect(ready).toContainEqual({ name: "Marieke's kitchen", kids: [], language: "en", starter: true, people: [{ username: "marieke", password: "m" }] });
});

test("no login is in two kitchens", () => {
  const logins = kitchenConfigs.flatMap((kitchen) => kitchen.logins);
  expect(new Set(logins).size).toBe(logins.length);
});
