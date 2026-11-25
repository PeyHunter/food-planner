import { useState } from "react";
import { t } from "../i18n.ts";
import { BrowseScreen } from "../recipes/BrowseScreen.tsx";
import { RecipeList } from "../recipes/RecipeList.tsx";
import "../recipes/recipes.css";
import "./home.css";

type View = "grid" | "book";

const viewKey = "home-recipe-view";

function savedView(): View {
  try {
    return localStorage.getItem(viewKey) === "book" ? "book" : "grid";
  } catch {
    return "grid";
  }
}

/**
 * The one Recipes tab. A header row of three buttons sits on top, then a Grid | Book switch picks the view.
 * The grid is the default; the book is remembered. #/recipes/list opens the grid whatever was picked last.
 */
export function HomeTab({ list = false }: { list?: boolean }) {
  const [view, setView] = useState<View>(() => (list ? "grid" : savedView()));

  const show = (next: View) => {
    setView(next);
    try {
      localStorage.setItem(viewKey, next);
    } catch {
      // Private mode: the choice just isn't remembered.
    }
  };

  return (
    <div className="recipes home-surface">
      <section className="home-tab">
        <div className="home-actions">
          <a className="btn small white" href="#/recipes/can-make">
            {t("What can I make?")}
          </a>
          <a className="btn small white" href="#/recipes/freezer">
            {t("❄ Freezer")}
          </a>
          <a className="btn small sun" href="#/recipes/new" aria-label={t("+ Add recipe")}>
            {t("+ Add")}
          </a>
        </div>
        <div className="home-head">
          <h2>{view === "grid" ? t("What shall we cook?") : <>{t("Flip through")} <em>{t("the book")}</em></>}</h2>
          <div className="view-toggle" role="group" aria-label={t("Recipe view")}>
            <button type="button" className="chip" aria-pressed={view === "grid"} onClick={() => show("grid")}>
              {t("Grid")}
            </button>
            <button type="button" className="chip" aria-pressed={view === "book"} onClick={() => show("book")}>
              {t("Book")}
            </button>
          </div>
        </div>
        {view === "grid" ? <RecipeList /> : <BrowseScreen />}
        <div className="home-links">
          <a href="#/recipes/ingredients">{t("Ingredients")}</a>
          <a href="#/recipes/from-link">{t("From a link")}</a>
          <a href="#/recipes/from-photo">{t("Photo to recipe")}</a>
        </div>
      </section>
    </div>
  );
}
