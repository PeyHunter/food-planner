import { useEffect, useState } from "react";
import { RecipeForm } from "./RecipeForm.tsx";
import { RecipeList } from "./RecipeList.tsx";
import { RecipePage } from "./RecipePage.tsx";
import "./recipes.css";

type Route = { screen: "list" } | { screen: "new" } | { screen: "recipe"; id: string } | { screen: "edit"; id: string };

// #/recipes, #/recipes/new, #/recipes/<id>, #/recipes/<id>/edit
function readRoute(hash: string): Route {
  const [, section, id, action] = hash.replace(/^#/, "").split("/");
  if (section !== "recipes" || !id) return { screen: "list" };
  if (id === "new") return { screen: "new" };
  return action === "edit" ? { screen: "edit", id } : { screen: "recipe", id };
}

/** The Recipes tab: list, recipe page and edit form, picked by the URL hash so reload and back work. */
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
      {route.screen === "list" && <RecipeList />}
      {route.screen === "new" && <RecipeForm />}
      {route.screen === "edit" && <RecipeForm key={route.id} id={route.id} />}
      {route.screen === "recipe" && <RecipePage key={route.id} id={route.id} />}
    </div>
  );
}
