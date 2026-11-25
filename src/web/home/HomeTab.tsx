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

export function HomeTab() {
  const [view, setView] = useState<View>(savedView);

  const show = (next: View) => {
    setView(next);
    try {
      localStorage.setItem(viewKey, next);
    } catch {}
  };

  return (
    <div className="recipes home-surface">
      <section className="home-tab">
        <div className="home-head">
          <p className="kicker">{t("Your kitchen")}</p>
          <h2>{t("What shall we cook?")}</h2>
          <div className="home-actions">
            <a className="btn small sun" href="#/recipes/new" aria-label={t("+ Add recipe")}>
              {t("+ Add")}
            </a>
            <a className="btn small white" href="#/week">
              {t("Plan the week")}
            </a>
            <a className="btn small white" href="#/recipes/can-make">
              {t("What can I make?")}
            </a>
            <a className="btn small white" href="#/recipes/freezer">
              {t("❄ Freezer")}
            </a>
            <a className="btn small white" href="#/recipes/ingredients">
              {t("Ingredients")}
            </a>
            <a className="btn small white" href="#/recipes/from-link">
              {t("From a link")}
            </a>
            <a className="btn small white" href="#/recipes/from-photo">
              {t("Photo to recipe")}
            </a>
          </div>
          <div className="view-toggle" role="group" aria-label={t("Recipe view")}>
            <button type="button" className="chip" aria-pressed={view === "grid"} onClick={() => show("grid")}>
              {t("Grid")}
            </button>
            <button type="button" className="chip" aria-pressed={view === "book"} onClick={() => show("book")}>
              {t("Flip through the book")}
            </button>
          </div>
        </div>
        {view === "grid" ? <RecipeList home /> : <BrowseScreen onGrid={() => show("grid")} />}
      </section>
    </div>
  );
}
