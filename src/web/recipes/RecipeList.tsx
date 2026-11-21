import { useEffect, useState } from "react";
import { t } from "../i18n.ts";
import { kidsTabLabel } from "../kids/labels.ts";
import { useKidNames } from "../kitchen.ts";
import { formatMinutes, type RecipeSummary } from "../../shared/recipes.ts";
import { childRecipeTag } from "../../shared/week.ts";
import { listRecipes } from "./api.ts";
import { TypeStickers } from "./RecipePage.tsx";
import { StarterRecipesButton } from "./StarterRecipesButton.tsx";

export function RecipeList() {
  const [q, setQ] = useState("");
  const [recipes, setRecipes] = useState<RecipeSummary[]>();
  const [problem, setProblem] = useState<string>();
  // The kids' own recipes live on the kids tab; the list only says how many it leaves out.
  const [hidden, setHidden] = useState(0);
  const [loads, setLoads] = useState(0);
  const kidNames = useKidNames();

  useEffect(() => {
    let current = true;
    const timer = setTimeout(() => {
      listRecipes(q).then(
        (found) => {
          if (!current) return;
          const book = found.filter((recipe) => !recipe.tags.includes(childRecipeTag));
          setRecipes(book);
          setHidden(found.length - book.length);
          setProblem(undefined);
        },
        (error: Error) => current && setProblem(error.message),
      );
    }, 150);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [q, loads]);

  return (
    <section className="recipe-list">
      <div className="bar">
        <h2>{t("Recipes")}</h2>
        <span className="bar-buttons">
          <a className="ink-button white small" href="#/recipes">
            {t("Book")}
          </a>
          <a className="ink-button white small" href="#/recipes/ingredients">
            {t("Ingredients")}
          </a>
          <a className="ink-button white small" href="#/recipes/from-link">
            {t("From a link")}
          </a>
          <a className="ink-button white small" href="#/recipes/from-photo">
            {t("Photo to recipe")}
          </a>
          <a className="ink-button" href="#/recipes/new">
            {t("+ Add recipe")}
          </a>
        </span>
      </div>
      <input type="search" className="search" placeholder={t("Search by name or ingredient")} aria-label={t("Search recipes")} value={q} onChange={(event) => setQ(event.target.value)} />
      {problem && <p role="alert">{problem}</p>}
      {recipes && recipes.length === 0 && !q && (
        <div className="empty">
          <p className="big">{t("Nothing here yet.")}</p>
          <p>{t("Add your first recipe.")}</p>
          <StarterRecipesButton onAdded={() => setLoads((count) => count + 1)} />
        </div>
      )}
      {recipes && recipes.length === 0 && q && <p className="hint">{t('No recipe matches "{q}".', { q })}</p>}
      {hidden > 0 && (
        <p className="hint kids-hint">
          <a href="#/kids">{t("Kids' recipes are on the {tab} tab →", { tab: kidsTabLabel(kidNames) })}</a>
        </p>
      )}
      <ul className="cards">
        {recipes?.map((recipe) => (
          <li key={recipe.id}>
            <a className="card" href={`#/recipes/${recipe.id}`}>
              {recipe.mainPhoto ? <img src={recipe.mainPhoto.url} alt="" loading="lazy" /> : <span className="no-photo" aria-hidden="true" />}
              <span className="card-text">
                <strong>{recipe.title}</strong>
                {recipe.minutes !== null && <span className="card-time">{formatMinutes(recipe.minutes)}</span>}
                <TypeStickers recipe={recipe} />
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
