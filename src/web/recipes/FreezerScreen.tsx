import { useEffect, useState } from "react";
import { t } from "../i18n.ts";
import type { FreezerItem } from "../../shared/week.ts";
import { addToFreezer, getFreezer } from "./api.ts";
import { TypeStickers } from "./RecipePage.tsx";

/** What is in the freezer, with − / + to put it right. */
export function FreezerScreen() {
  const [items, setItems] = useState<FreezerItem[]>();
  const [problem, setProblem] = useState<string>();

  const load = () =>
    getFreezer().then(
      (found) => (setItems(found), setProblem(undefined)),
      (error: Error) => setProblem(error.message),
    );

  useEffect(() => {
    void load();
  }, []);

  const change = async (recipeId: string, add: number) => {
    try {
      const { count } = await addToFreezer(recipeId, add);
      setItems((list) => list?.map((item) => (item.recipe.id === recipeId ? { ...item, count } : item)));
    } catch (error) {
      setProblem((error as Error).message);
      await load();
    }
  };

  return (
    <section className="freezer">
      <nav className="bar">
        <a className="back" href="#/recipes" aria-label="Back to recipes">
          ←
        </a>
        <h2>
          <span aria-hidden="true">❄ </span>{t("Freezer")}
        </h2>
        <span />
      </nav>
      {problem && <p role="alert">{problem}</p>}
      {items && items.length === 0 && <p className="hint">{t("Nothing in the freezer. After you cook a freezable dish, press \"I made this\" and put the spare portions here.")}</p>}
      <ul className="freezer-rows">
        {items?.map(({ recipe, count }) => (
          <li key={recipe.id} className={`panel freezer-row${count === 0 ? " gone" : ""}`}>
            <a href={`#/recipes/${recipe.id}`} className="freezer-dish">
              <strong>{recipe.title}</strong>
              <TypeStickers recipe={recipe} />
            </a>
            <div className="stepper" role="group" aria-label={`Portions of ${recipe.title}`}>
              <button type="button" aria-label={`One less ${recipe.title}`} disabled={count === 0} onClick={() => void change(recipe.id, -1)}>
                −
              </button>
              <output aria-live="polite">
                {count} {count === 1 ? t("portion") : t("portions")}
              </output>
              <button type="button" aria-label={`One more ${recipe.title}`} onClick={() => void change(recipe.id, 1)}>
                +
              </button>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
