import { useEffect, useMemo, useState } from "react";
import { t } from "../i18n.ts";
import { kidsTabLabel } from "../kids/labels.ts";
import { useKidNames } from "../kitchen.ts";
import { formatMinutes, type RecipeSummary } from "../../shared/recipes.ts";
import { childRecipeTag } from "../../shared/week.ts";
import { listRecipes } from "./api.ts";
import { chipsFor, filterBook, sameChip, type Chip } from "./book.ts";
import { TypeStickers, typeColour } from "./RecipePage.tsx";
import { StarterRecipesButton } from "./StarterRecipesButton.tsx";

const isAdult = (recipe: RecipeSummary) => !recipe.tags.includes(childRecipeTag) && recipe.ageFromMonths === null && recipe.ageToMonths === null;

/** Never made comes first, then the oldest cook, then the title. */
const byLeastRecent = (a: RecipeSummary, b: RecipeSummary) => (a.lastMadeOn ?? "").localeCompare(b.lastMadeOn ?? "") || a.title.localeCompare(b.title);

export function RecipeList({ home = false }: { home?: boolean }) {
  const [q, setQ] = useState("");
  const [recipes, setRecipes] = useState<RecipeSummary[]>();
  const [chosen, setChosen] = useState<Chip[]>([]);
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
          const book = found.filter(isAdult);
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

  const chips = useMemo(() => chipsFor(recipes ?? []), [recipes]);
  const shown = useMemo(() => filterBook(recipes ?? [], chosen), [recipes, chosen]);
  const ideas = useMemo(
    () =>
      (recipes ?? [])
        .filter((recipe) => recipe.mainPhoto)
        .sort(byLeastRecent)
        .slice(0, 8),
    [recipes],
  );

  const toggle = (chip: Chip) => setChosen((current) => (current.some((each) => sameChip(each, chip)) ? current.filter((each) => !sameChip(each, chip)) : [...current, chip]));

  return (
    <section className="recipe-list">
      {!home && (
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
      )}
      <input type="search" className="search" placeholder={t("Search by name or ingredient")} aria-label={t("Search recipes")} value={q} onChange={(event) => setQ(event.target.value)} />
      {recipes && recipes.length > 0 && (
        <div className="chips" role="group" aria-label="Filter recipes">
          {chips.map((chip) => (
            <button
              key={`${chip.kind}:${chip.value}`}
              type="button"
              className="chip"
              aria-pressed={chosen.some((each) => sameChip(each, chip))}
              onClick={() => toggle(chip)}
            >
              {chip.value === "freezable" ? t("❄ freezable") : t(chip.value)}
            </button>
          ))}
        </div>
      )}
      {problem && <p role="alert">{problem}</p>}
      {recipes && shown.length === 0 && !q && chosen.length === 0 && (
        <div className={home ? "card home-empty" : "empty"}>
          <p className="big">{t("Your recipe book is empty.")}</p>
          <a className="btn small sun" href="#/recipes/new">
            {t("Add your first recipe.")}
          </a>
          <StarterRecipesButton onAdded={() => setLoads((count) => count + 1)} />
        </div>
      )}
      {recipes && shown.length === 0 && (q || chosen.length > 0) && <p className="hint">{q ? t('No recipe matches "{q}".', { q }) : t("No page matches.")}</p>}
      {hidden > 0 && (
        <p className="hint kids-hint">
          <a href="#/kids">{t("Kids' recipes are on the {tab} tab →", { tab: kidsTabLabel(kidNames) })}</a>
        </p>
      )}
      <ul className={home ? "home-grid" : "cards"}>
        {shown.map((recipe) => (
          <li key={recipe.id}>
            {home ? (
              <a className="home-card" href={`#/recipes/${recipe.id}`}>
                {recipe.mainPhoto ? <img src={recipe.mainPhoto.url} alt="" loading="lazy" /> : <span className="home-photo home-plate" aria-hidden="true" />}
                <span className="home-card-text">
                  <strong>{recipe.title}</strong>
                  {recipe.types.length > 0 && (
                    <span className="home-types">
                      {recipe.types.map((type) => (
                        <span key={type} className={`sticker ${typeColour[type] ?? "sun"}`}>
                          {t(type)}
                        </span>
                      ))}
                    </span>
                  )}
                </span>
              </a>
            ) : (
              <a className="card" href={`#/recipes/${recipe.id}`}>
                {recipe.mainPhoto ? <img src={recipe.mainPhoto.url} alt="" loading="lazy" /> : <span className="no-photo" aria-hidden="true" />}
                <span className="card-text">
                  <strong>{recipe.title}</strong>
                  {recipe.minutes !== null && <span className="card-time">{formatMinutes(recipe.minutes)}</span>}
                  <TypeStickers recipe={recipe} />
                </span>
              </a>
            )}
          </li>
        ))}
      </ul>
      {home && ideas.length > 0 && !q && chosen.length === 0 && (
        <section className="home-ideas">
          <h2 className="home-h">{t("Ideas")}</h2>
          <ul className="home-rail">
            {ideas.map((recipe) => (
              <li key={recipe.id}>
                <a className="home-idea" href={`#/recipes/${recipe.id}`}>
                  <img src={recipe.mainPhoto!.url} alt="" loading="lazy" />
                  <span>{recipe.title}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}
