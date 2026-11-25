import { useEffect, useState } from "react";
import { HomeTab } from "../home/HomeTab.tsx";
import { LinkRecipeScreen } from "./LinkRecipeScreen.tsx";
import { SaveShared } from "./SaveShared.tsx";
import { CanMakeScreen } from "./CanMakeScreen.tsx";
import { FreezerScreen } from "./FreezerScreen.tsx";
import { IngredientsScreen } from "./IngredientsScreen.tsx";
import { PhotoRecipeScreen } from "./PhotoRecipeScreen.tsx";
import { RecipeForm, type Prefill } from "./RecipeForm.tsx";
import { RecipeList } from "./RecipeList.tsx";
import { RecipePage } from "./RecipePage.tsx";
import { VegetarianDraftForm } from "./VegetarianSheet.tsx";
import "./recipes.css";

type Route =
  | { screen: "book" }
  | { screen: "list" }
  | { screen: "new"; start: Prefill }
  | { screen: "ingredients" }
  | { screen: "from-photo" }
  | { screen: "from-link" }
  | { screen: "freezer" }
  | { screen: "can-make" }
  | { screen: "recipe"; id: string; week: string | null }
  | { screen: "edit"; id: string }
  | { screen: "vegetarian"; id: string }
  | { screen: "save"; token: string };

// #/recipes (the unified home surface), #/recipes/list, #/recipes/new[?tag=for Runi&from=7], #/recipes/ingredients, #/recipes/from-photo, #/recipes/from-link, #/recipes/freezer, #/recipes/can-make, #/recipes/<id>, #/recipes/<id>/edit, #/recipes/<id>/vegetarian, #/recipes/save/<share token>
function readRoute(hash: string): Route {
  const [path = "", query = ""] = hash.replace(/^#/, "").split("?");
  const [, section, id, action] = path.split("/");
  if (section !== "recipes" || !id) return { screen: "book" };
  if (id === "new") {
    const params = new URLSearchParams(query);
    return { screen: "new", start: { tags: params.getAll("tag"), ageFrom: params.get("from") ?? "" } };
  }
  if (id === "save" && action) return { screen: "save", token: action };
  if (id === "list" || id === "ingredients" || id === "from-photo" || id === "from-link" || id === "freezer" || id === "can-make") return { screen: id };
  if (action === "edit" || action === "vegetarian") return { screen: action, id };
  return { screen: "recipe", id, week: new URLSearchParams(query).get("week") };
}

/** Recipe routes: the home surface, list, recipe page and edit form, picked by the URL hash so reload and back work. */
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

  if (route.screen === "book") return <HomeTab />;

  return (
    <div className="recipes">
      {route.screen === "list" && <RecipeList />}
      {route.screen === "new" && <RecipeForm start={route.start} />}
      {route.screen === "ingredients" && <IngredientsScreen />}
      {route.screen === "from-photo" && <PhotoRecipeScreen />}
      {route.screen === "from-link" && <LinkRecipeScreen />}
      {route.screen === "freezer" && <FreezerScreen />}
      {route.screen === "can-make" && <CanMakeScreen />}
      {route.screen === "edit" && <RecipeForm key={route.id} id={route.id} />}
      {route.screen === "vegetarian" && <VegetarianDraftForm key={route.id} id={route.id} />}
      {route.screen === "recipe" && <RecipePage key={route.id} id={route.id} week={route.week} />}
      {route.screen === "save" && <SaveShared key={route.token} token={route.token} />}
    </div>
  );
}
