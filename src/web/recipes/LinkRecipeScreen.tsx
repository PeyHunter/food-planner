import { useState, type FormEvent } from "react";
import type { PhotoRecipeDraft } from "../../shared/recipes.ts";
import { readRecipeLink } from "./api.ts";
import { RecipeForm } from "./RecipeForm.tsx";

/** Recipe from a link: paste a recipe page's address; the server reads the recipe and its dish picture into the edit form to check. */
export function LinkRecipeScreen() {
  const [link, setLink] = useState("");
  const [reading, setReading] = useState(false);
  const [problem, setProblem] = useState<string>();
  const [draft, setDraft] = useState<PhotoRecipeDraft>();

  if (draft) return <RecipeForm fromPhoto={{ ...draft, photos: [], intro: "Read from the link. Check it, fix anything that's wrong, then save." }} />;

  const read = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setReading(true);
    setProblem(undefined);
    try {
      setDraft(await readRecipeLink(link));
    } catch (error) {
      setProblem((error as Error).message);
      setReading(false);
    }
  };

  return (
    <form className="recipe-form link-recipe" onSubmit={read}>
      <nav className="bar">
        <a className="back" href="#/recipes/new" aria-label="Back">
          ←
        </a>
        <h2>Recipe from a link</h2>
      </nav>
      <p className="hint">Paste the link to a recipe page. We'll fill in the name, ingredients, steps and a picture of the dish for you to check.</p>
      <label>
        Link
        <input type="url" inputMode="url" autoCapitalize="none" autoCorrect="off" placeholder="https://…" required value={link} onChange={(event) => setLink(event.target.value)} disabled={reading} />
      </label>
      <button type="submit" className="ink-button big" disabled={reading || !link.trim()}>
        {reading ? "Reading the recipe…" : "Get the recipe"}
      </button>
      {reading && (
        <p className="hint" role="status">
          Reading the recipe… This can take up to a minute.
        </p>
      )}
      {problem && <p role="alert">{problem}</p>}
    </form>
  );
}
