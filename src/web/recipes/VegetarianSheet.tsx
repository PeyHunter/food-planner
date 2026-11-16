import { useEffect, useRef, useState, type FormEvent } from "react";
import { t } from "../i18n.ts";
import { useSheet } from "../sheet.ts";
import type { PhotoRecipeDraft, Recipe } from "../../shared/recipes.ts";
import { call, go, json } from "./api.ts";
import { RecipeForm } from "./RecipeForm.tsx";
import "./vegetarian.css";

type Choice = "tofu" | "vegetables" | "custom";

/** Grown-up recipes with meat or chicken. Children's recipes and ones already without meat don't get the button. */
export const canMakeVegetarian = (recipe: Pick<Recipe, "types" | "ageFromMonths" | "ageToMonths">) =>
  recipe.ageFromMonths === null && recipe.ageToMonths === null && (recipe.types.includes("Meat") || recipe.types.includes("Chicken"));

// The draft waits here while the hash changes to the form, so back goes to the recipe page.
let waiting: { recipeId: string; draft: PhotoRecipeDraft } | undefined;

/** t("Make vegetarian") on the recipe page: asks what goes in place of the meat, then opens the new version in the edit form. */
export function MakeVegetarian({ recipe }: { recipe: Pick<Recipe, "id" | "title" | "types" | "ageFromMonths" | "ageToMonths"> }) {
  const [open, setOpen] = useState(false);
  if (!canMakeVegetarian(recipe)) return null;
  return (
    <>
      <button type="button" className="ink-button white small" onClick={() => setOpen(true)}>
        {t("Make vegetarian")}
      </button>
      {open && <VegetarianSheet recipe={recipe} onClose={() => setOpen(false)} />}
    </>
  );
}

function VegetarianSheet({ recipe, onClose }: { recipe: Pick<Recipe, "id" | "title">; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [choice, setChoice] = useState<Choice>("tofu");
  const [custom, setCustom] = useState("");
  const [making, setMaking] = useState(false);
  const [problem, setProblem] = useState<string>();

  useSheet(ref);

  const make = async (event: FormEvent) => {
    event.preventDefault();
    setMaking(true);
    setProblem(undefined);
    try {
      const replacement = choice === "custom" ? { custom: custom.trim() } : choice;
      const draft = await call<PhotoRecipeDraft>(`/api/recipes/${recipe.id}/vegetarian`, json("POST", { replacement }));
      waiting = { recipeId: recipe.id, draft };
      go(`/recipes/${recipe.id}/vegetarian`);
    } catch (error) {
      setProblem((error as Error).message);
      setMaking(false);
    }
  };

  const option = (value: Choice, label: string) => (
    <label className="veggie-option">
      <input type="radio" name="replacement" value={value} checked={choice === value} onChange={() => setChoice(value)} disabled={making} />
      {label}
    </label>
  );

  return (
    <dialog ref={ref} className="veggie-sheet bottom-sheet" aria-label="Make vegetarian" onClose={onClose}>
      <form onSubmit={make}>
        <div className="sheet-head">
          <h2>{t("Make vegetarian")}</h2>
          <button type="button" className="ink-button white small" onClick={onClose}>
            {t("Close")}
          </button>
        </div>
        <p className="hint">{t("A new vegetarian version of {title}. The original stays as it is.", { title: recipe.title })}</p>
        <fieldset disabled={making}>
          <legend>{t("Replace the meat with…")}</legend>
          {option("tofu", t("Tofu"))}
          {option("vegetables", t("Vegetables"))}
          {option("custom", t("Something else"))}
          {choice === "custom" && (
            <input aria-label="What to use instead" placeholder={t("e.g. chickpeas")} value={custom} onChange={(event) => setCustom(event.target.value)} maxLength={100} required autoFocus />
          )}
        </fieldset>
        {problem && <p role="alert">{problem}</p>}
        <button type="submit" className="ink-button big" disabled={making}>
          {making ? t("Making it… this can take a minute") : t("Make it")}
        </button>
      </form>
    </dialog>
  );
}

/** #/recipes/<id>/vegetarian: the vegetarian version to check and save as a new recipe. After a reload the draft is gone, so it goes back to the recipe. */
export function VegetarianDraftForm({ id }: { id: string }) {
  const [draft] = useState(() => (waiting?.recipeId === id ? waiting.draft : undefined));
  useEffect(() => {
    if (!draft) go(`/recipes/${id}`);
  }, [draft, id]);
  if (!draft) return null;
  return <RecipeForm fromPhoto={{ ...draft, photos: [], intro: t("The vegetarian version. Check it, fix anything that's wrong, then save it as a new recipe.") }} />;
}
