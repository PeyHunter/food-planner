import { useEffect, useRef, useState, type FormEvent } from "react";
import { t } from "../i18n.ts";
import type { PhotoRecipeDraft } from "../../shared/recipes.ts";
import { readRecipeLink } from "./api.ts";
import { RecipeForm } from "./RecipeForm.tsx";

/** The page address from #/recipes/from-link?url=…, when "What can I make?" sends a recipe here. */
const linkFromHash = () => new URLSearchParams(window.location.hash.split("?")[1] ?? "").get("url")?.trim() ?? "";

/** Recipe from a link: paste a recipe page's address; the server reads the recipe and its dish picture into the edit form to check. */
export function LinkRecipeScreen() {
  const [link, setLink] = useState(linkFromHash);
  const [reading, setReading] = useState(false);
  const [problem, setProblem] = useState<string>();
  const [draft, setDraft] = useState<PhotoRecipeDraft>();
  const started = useRef(false);

  const readLink = async (address: string) => {
    setReading(true);
    setProblem(undefined);
    try {
      setDraft(await readRecipeLink(address));
    } catch (error) {
      setProblem((error as Error).message);
      setReading(false);
    }
  };

  // A link handed over from "What can I make?" is read at once; the ref keeps a dev-mode double mount from reading twice.
  useEffect(() => {
    if (started.current || !link) return;
    started.current = true;
    void readLink(link);
  }, []);

  if (draft) return <RecipeForm fromPhoto={{ ...draft, photos: [], intro: t("Read from the link. Check it, fix anything that's wrong, then save.") }} />;

  const read = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await readLink(link);
  };

  return (
    <form className="recipe-form link-recipe" onSubmit={read}>
      <nav className="bar">
        <a className="back" href="#/recipes/new" aria-label="Back">
          ←
        </a>
        <h2>{t("Recipe from a link")}</h2>
      </nav>
      <p className="hint">{t("Paste the link to a recipe page. We'll fill in the name, ingredients, steps and a picture of the dish for you to check.")}</p>
      <label>
        {t("Link")}
        <input type="url" inputMode="url" autoCapitalize="none" autoCorrect="off" placeholder="https://…" required value={link} onChange={(event) => setLink(event.target.value)} disabled={reading} />
      </label>
      <button type="submit" className="ink-button big" disabled={reading || !link.trim()}>
        {reading ? t("Reading the recipe…") : t("Get the recipe")}
      </button>
      {reading && (
        <p className="hint" role="status">
          {t("Reading the recipe… This can take up to a minute.")}
        </p>
      )}
      {problem && <p role="alert">{problem}</p>}
    </form>
  );
}
