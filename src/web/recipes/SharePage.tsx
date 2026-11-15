import { useEffect, useState } from "react";
import { formatMinutes, sharePhotoMedia, type SharedRecipe } from "../../shared/recipes.ts";
import { IngredientsPanel, StepsPanel, TypeStickers } from "./RecipePage.tsx";
import "./recipes.css";

type State = { kind: "loading" } | { kind: "gone" } | { kind: "offline" } | { kind: "ready"; recipe: SharedRecipe };

/** What the server put in the page: the recipe, or null for a dead link. Missing under the Vite dev server. */
function fromPage(): State | undefined {
  const data = document.getElementById("share-data")?.textContent;
  if (!data) return undefined;
  const recipe = JSON.parse(data) as SharedRecipe | null;
  return recipe ? { kind: "ready", recipe } : { kind: "gone" };
}

/** The public page behind a share link, /s/<token>: one recipe, read-only, no login. */
export function SharePage({ token }: { token: string }) {
  const [state, setState] = useState<State>(() => fromPage() ?? { kind: "loading" });
  const loaded = state.kind !== "loading";

  useEffect(() => {
    if (loaded) return;
    fetch(`/api/share/${encodeURIComponent(token)}`)
      .then(async (response) => {
        if (response.status === 404) return setState({ kind: "gone" });
        if (!response.ok) return setState({ kind: "offline" });
        const recipe = (await response.json()) as SharedRecipe;
        document.title = `${recipe.title} · Food planner`;
        setState({ kind: "ready", recipe });
      })
      .catch(() => setState({ kind: "offline" }));
  }, [token, loaded]);

  return (
    <main className="app">
      <div className="recipes">
        {state.kind === "gone" && (
          <section className="panel gone">
            <span className="sticker tomato tilt-l">Not found</span>
            <h1>This link doesn't work</h1>
            <p>The recipe was unshared, or the link is wrong. Ask the person who sent it for a new one.</p>
          </section>
        )}
        {state.kind === "offline" && <p role="alert">Can't reach the server right now. Try again in a moment.</p>}
        {state.kind === "ready" && <SharedRecipeView recipe={state.recipe} />}
        {state.kind === "ready" && (
          <section className="panel save-shared">
            <h2>Use our food planner too?</h2>
            <p>Copy this recipe into your own recipes, so you can plan it and shop for it.</p>
            <a className="ink-button" href={`/#/recipes/save/${encodeURIComponent(token)}`}>
              Save to my recipes
            </a>
          </section>
        )}
      </div>
    </main>
  );
}

function SharedRecipeView({ recipe }: { recipe: SharedRecipe }) {
  const gallery = recipe.photos.filter((photo) => photo.role === "gallery");
  return (
    <article className="shared">
      <span className="sticker white tilt-r shared-from">Shared from our food planner</span>
      <div className="hero">
        {recipe.mainPhoto ? (
          <picture>
            <source media={sharePhotoMedia.wide} srcSet={recipe.mainPhoto.url} />
            <img src={recipe.mainPhoto.smallUrl} alt={recipe.title} fetchPriority="high" />
          </picture>
        ) : (
          <span className="no-photo" aria-hidden="true" />
        )}
        <TypeStickers recipe={recipe} />
      </div>
      <h1>{recipe.title}</h1>
      {recipe.minutes !== null && <p className="time">Takes {formatMinutes(recipe.minutes)}</p>}
      {recipe.description && <p className="description">{recipe.description}</p>}
      <IngredientsPanel recipe={recipe} />
      <StepsPanel steps={recipe.steps} />
      {gallery.length > 0 && (
        <section className="panel">
          <h2>Photos</h2>
          <ul className="gallery">
            {gallery.map((photo) => (
              <li key={photo.id}>
                <a href={photo.url} target="_blank" rel="noreferrer">
                  <img src={photo.url} alt="Recipe photo" loading="lazy" />
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}
