import { expect, test } from "vitest";
import { switchLanguage } from "../src/web/i18n.ts";
import { kidsTabLabel, tagLabel } from "../src/web/kids/labels.ts";

test("a kitchen with Vilje and Konrad gets a Kids tab and sees the child tag as for kids", () => {
  switchLanguage("en");
  expect(kidsTabLabel(["Vilje", "Konrad"])).toBe("Kids");
  expect(tagLabel("for Runi", ["Vilje", "Konrad"])).toBe("for kids");
  expect(tagLabel("freezable", ["Vilje", "Konrad"])).toBe("freezable");
  switchLanguage("da");
  expect(kidsTabLabel(["Vilje", "Konrad"])).toBe("Børn");
  expect(tagLabel("for Runi", ["Vilje", "Konrad"])).toBe("til børnene");
  switchLanguage("en");
});

test("one child names the tab; Runi's kitchen keeps for Runi", () => {
  expect(kidsTabLabel(["Runi Lee"])).toBe("Runi Lee");
  expect(kidsTabLabel(["Vilje"])).toBe("Vilje");
  expect(kidsTabLabel([])).toBe("Kids");
  expect(tagLabel("for Runi", ["Runi Lee", "Konrad"])).toBe("for Runi");
});
