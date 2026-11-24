import { useEffect, useState } from "react";
import { t } from "../i18n.ts";
import type { RecipeSummary } from "../../shared/recipes.ts";
import { childRecipeTag } from "../../shared/week.ts";
import { listRecipes } from "../recipes/api.ts";
import { typeColour } from "../recipes/RecipePage.tsx";
import "./home.css";

/** Never made comes first, then the oldest cook, then the title. */
const byLeastRecent = (a: RecipeSummary, b: RecipeSummary) => (a.lastMadeOn ?? "").localeCompare(b.lastMadeOn ?? "") || a.title.localeCompare(b.title);

export function HomeTab() {
  const [recipes, setRecipes] = useState<RecipeSummary[]>();
  const [ideas, setIdeas] = useState<RecipeSummary[]>([]);
  const [problem, setProblem] = useState<string>();

  useEffect(() => {
    let current = true;
    listRecipes("").then(
      (found) => {
        if (!current) return;
        setRecipes(found);
        setIdeas(
          found
            .filter((recipe) => recipe.mainPhoto && recipe.ageFromMonths === null && recipe.ageToMonths === null && !recipe.tags.includes(childRecipeTag))
            .sort(byLeastRecent)
            .slice(0, 8),
        );
      },
      (error: Error) => current && setProblem(error.message),
    );
    return () => {
      current = false;
    };
  }, []);

  return (
    <section className="home-tab">
      <div className="home-head">
        <p className="kicker">{t("Your kitchen")}</p>
        <h2>{t("What shall we cook?")}</h2>
        <a className="btn sun" href="#/week">
          {t("Plan the week")}
        </a>
      </div>
      {problem && <p role="alert">{problem}</p>}
      <h2 className="home-h">{t("All recipes")}</h2>
      {recipes?.length === 0 ? (
        <div className="card home-empty">
          <p className="big">{t("Your recipe book is empty.")}</p>
          <a className="btn small sun" href="#/recipes/new">
            {t("Add your first recipe.")}
          </a>
        </div>
      ) : (
        <ul className="home-grid">
          {recipes?.map((recipe) => (
            <li key={recipe.id}>
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
            </li>
          ))}
        </ul>
      )}
      {ideas.length > 0 && (
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
