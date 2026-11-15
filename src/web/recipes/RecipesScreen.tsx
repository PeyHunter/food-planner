import { useEffect, useState } from "react";
import { BrowseScreen } from "./BrowseScreen.tsx";
import { IngredientsScreen } from "./IngredientsScreen.tsx";
import { RecipeForm, type Prefill } from "./RecipeForm.tsx";
import { RecipeList } from "./RecipeList.tsx";
import { RecipePage } from "./RecipePage.tsx";
import "./recipes.css";

type Route = { screen: "book" } | { screen: "list" } | { screen: "new"; start: Prefill } | { screen: "ingredients" } | { screen: "recipe"; id: string } | { screen: "edit"; id: string };

// #/recipes (the book), #/recipes/list, #/recipes/new[?tag=for Runi&from=7], #/recipes/ingredients, #/recipes/<id>, #/recipes/<id>/edit
function readRoute(hash: string): Route {
  const [path = "", query = ""] = hash.replace(/^#/, "").split("?");
  const [, section, id, action] = path.split("/");
  if (section !== "recipes" || !id) return { screen: "book" };
  if (id === "new") {
    const params = new URLSearchParams(query);
    return { screen: "new", start: { tags: params.getAll("tag"), ageFrom: params.get("from") ?? "" } };
  }
  if (id === "list" || id === "ingredients") return { screen: id };
  return action === "edit" ? { screen: "edit", id } : { screen: "recipe", id };
}

/** The Recipes tab: the book, list, recipe page and edit form, picked by the URL hash so reload and back work. */
export function RecipesScreen() {
  const [route, setRoute] = useState(() => readRoute(window.location.hash));

  useEffect(() => {
    const onChange = () => {
      setRoute(readRoute(window.location.hash));
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  return (
    <div className="recipes">
      {route.screen === "book" && <BrowseScreen />}
      {route.screen === "list" && <RecipeList />}
      {route.screen === "new" && <RecipeForm start={route.start} />}
      {route.screen === "ingredients" && <IngredientsScreen />}
      {route.screen === "edit" && <RecipeForm key={route.id} id={route.id} />}
      {route.screen === "recipe" && <RecipePage key={route.id} id={route.id} />}
    </div>
  );
}
