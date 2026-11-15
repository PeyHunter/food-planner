import { useEffect, useState } from "react";
import { ageInWords } from "../../shared/child-age.ts";
import type { ChildView } from "../../shared/children.ts";
import { kidFoodWarnings, type KidFoodWarning } from "../../shared/kid-food.ts";
import { useKids } from "../kitchen.ts";
import { getChildren } from "./api.ts";
import "./kids.css";

const levelText = { "not-yet": "Not yet", careful: "Take care" } as const;

/** One child's warnings: "Not yet" ones first, each with why and where the advice comes from. */
export function WarningList({ warnings }: { warnings: KidFoodWarning[] }) {
  return (
    <ul className="kid-warnings">
      {warnings.map((warning) => (
        <li key={warning.ruleId} className={warning.level}>
          <span className={`sticker ${warning.level === "not-yet" ? "tomato" : "sun"}`}>{levelText[warning.level]}</span>
          <div>
            <strong>
              {warning.name}
              {warning.ingredients.length > 0 && <span className="found"> ({warning.ingredients.join(", ")})</span>}
            </strong>
            <p>{warning.advice}</p>
            <p className="source">Advice from {warning.source}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** A small badge on a meal: "⚠ Not yet: Honey" or "Take care: Salt". Nothing when there's nothing to say. */
export function WarnBadge({ warnings }: { warnings: KidFoodWarning[] }) {
  if (!warnings.length) return null;
  const level = warnings.some((warning) => warning.level === "not-yet") ? "not-yet" : "careful";
  const names = warnings.filter((warning) => warning.level === level).map((warning) => warning.name.split(" and ")[0]);
  const text = `${level === "not-yet" ? "⚠ Not yet" : "Take care"}: ${names.join(", ")}`;
  return (
    <span className={`warn-badge ${level}`} title={warnings.map((warning) => `${levelText[warning.level]}: ${warning.name}. ${warning.advice}`).join("\n")}>
      {text}
    </span>
  );
}

/** On a recipe page: what in it each child shouldn't have yet, or only with care. Nothing in a kitchen without kids. */
export function RecipeKidWarnings({ lines }: { lines: { ingredient: string; note: string }[] }) {
  const hasKids = useKids();
  const [kids, setKids] = useState<ChildView[]>([]);
  useEffect(() => {
    if (hasKids) getChildren().then(setKids, () => setKids([]));
  }, [hasKids]);

  const found = kids.map((kid) => ({ kid, warnings: kidFoodWarnings(lines, kid.ageMonths) })).filter(({ warnings }) => warnings.length);
  if (!found.length) return null;
  return (
    <section className="panel kid-warning-panel" aria-label="Kid food warnings">
      {found.map(({ kid, warnings }) => (
        <div key={kid.id}>
          <h2>
            ⚠️ For {kid.name}
            {kid.ageMonths !== null ? ` (${ageInWords(kid.ageMonths)})` : " (no birthday yet, so every age is checked)"}
          </h2>
          <WarningList warnings={warnings} />
        </div>
      ))}
      <p className="hint">Reminders from Danish and NHS advice for small children. Ask your health visitor if you're unsure.</p>
    </section>
  );
}
