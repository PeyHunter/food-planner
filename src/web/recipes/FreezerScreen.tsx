import { useEffect, useState, type FormEvent } from "react";
import type { RecipeSummary } from "../../shared/recipes.ts";
import type { FreezerItem } from "../../shared/week.ts";
import { addToFreezer, getFreezer, listRecipes } from "./api.ts";
import { TypeStickers } from "./RecipePage.tsx";

/** What is in the freezer, with − / + to put it right, and a form to put portions of any dish in. */
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
          <span aria-hidden="true">❄ </span>Freezer
        </h2>
        <span />
      </nav>
      {problem && <p role="alert">{problem}</p>}
      {items && items.length === 0 && <p className="hint">Nothing in the freezer. After you cook, press "I made this" and put the spare portions here, or add them below.</p>}
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
                {count} {count === 1 ? "portion" : "portions"}
              </output>
              <button type="button" aria-label={`One more ${recipe.title}`} onClick={() => void change(recipe.id, 1)}>
                +
              </button>
            </div>
          </li>
        ))}
      </ul>
      <AddToFreezer onAdded={load} onProblem={setProblem} />
    </section>
  );
}

function AddToFreezer({ onAdded, onProblem }: { onAdded: () => Promise<void>; onProblem: (problem: string) => void }) {
  const [recipes, setRecipes] = useState<RecipeSummary[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    listRecipes("").then(
      (found) => setRecipes(found),
      (error: Error) => onProblem(error.message),
    );
  }, [onProblem]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setBusy(true);
    try {
      await addToFreezer(String(data.get("recipe")), Number(data.get("portions")));
      form.reset();
      await onAdded();
    } catch (error) {
      onProblem((error as Error).message);
    }
    setBusy(false);
  };

  return (
    <form className="panel freezer-offer freezer-add" aria-labelledby="freezer-add-title" onSubmit={submit}>
      <h3 id="freezer-add-title">Add to the freezer</h3>
      <label>
        Dish
        <select name="recipe" required defaultValue="">
          <option value="" disabled>
            Pick a dish
          </option>
          {recipes.map((recipe) => (
            <option key={recipe.id} value={recipe.id}>
              {recipe.title}
            </option>
          ))}
        </select>
      </label>
      <label>
        Portions
        <input type="number" name="portions" min={1} max={50} step={1} defaultValue={1} required />
      </label>
      <button type="submit" className="ink-button" disabled={busy}>
        ❄ Add
      </button>
    </form>
  );
}
