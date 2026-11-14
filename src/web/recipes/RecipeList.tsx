import { useEffect, useState } from "react";
import type { RecipeSummary } from "../../shared/recipes.ts";
import { listRecipes } from "./api.ts";
import { TypeStickers } from "./RecipePage.tsx";

export function RecipeList() {
  const [q, setQ] = useState("");
  const [recipes, setRecipes] = useState<RecipeSummary[]>();
  const [problem, setProblem] = useState<string>();

  useEffect(() => {
    let current = true;
    const timer = setTimeout(() => {
      listRecipes(q).then(
        (found) => current && (setRecipes(found), setProblem(undefined)),
        (error: Error) => current && setProblem(error.message),
      );
    }, 150);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [q]);

  return (
    <section className="recipe-list">
      <div className="bar">
        <h2>Recipes</h2>
        <span className="bar-buttons">
          <a className="ink-button white small" href="#/recipes/ingredients">
            Ingredients
          </a>
          <a className="ink-button" href="#/recipes/new">
            + Add recipe
          </a>
        </span>
      </div>
      <input type="search" className="search" placeholder="Search by name or ingredient" aria-label="Search recipes" value={q} onChange={(event) => setQ(event.target.value)} />
      {problem && <p role="alert">{problem}</p>}
      {recipes && recipes.length === 0 && !q && (
        <div className="empty">
          <p className="big">Nothing here yet.</p>
          <p>Add your first recipe.</p>
        </div>
      )}
      {recipes && recipes.length === 0 && q && <p className="hint">No recipe matches "{q}".</p>}
      <ul className="cards">
        {recipes?.map((recipe) => (
          <li key={recipe.id}>
            <a className="card" href={`#/recipes/${recipe.id}`}>
              {recipe.mainPhoto ? <img src={recipe.mainPhoto.url} alt="" loading="lazy" /> : <span className="no-photo" aria-hidden="true" />}
              <span className="card-text">
                <strong>{recipe.title}</strong>
                <TypeStickers recipe={recipe} />
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
