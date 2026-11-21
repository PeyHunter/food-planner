import { t } from "../i18n.ts";
import { childRecipeTag } from "../../shared/week.ts";

/** The kids tab is named after the kitchen's own children: one child by name, otherwise "Kids". */
export function kidsTabLabel(names: string[]) {
  return names.length === 1 ? names[0]! : t("Kids");
}

/** The stored tag stays "for Runi"; a kitchen without a Runi sees it as "for kids". */
export function tagLabel(tag: string, names: string[]) {
  if (tag !== childRecipeTag || names.some((name) => /^runi\b/i.test(name))) return t(tag);
  return t("for kids");
}
