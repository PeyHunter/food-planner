import { useEffect, useState, type FormEvent } from "react";
import { shopSections, type Ingredient, type ShopSection } from "../../shared/recipes.ts";
import { units } from "../../shared/units.ts";
import { listIngredients, saveIngredient } from "./api.ts";

const sectionColour: Record<ShopSection, string> = {
  Vegetables: "mint",
  Dairy: "sky",
  "Meat & fish": "tomato",
  "Dry goods": "",
  Frozen: "lilac",
  Other: "white",
};

/** The kitchen's ingredient list: shop section, pack size and "always at home" for each one. */
export function IngredientsScreen() {
  const [q, setQ] = useState("");
  const [ingredients, setIngredients] = useState<Ingredient[]>();
  const [editing, setEditing] = useState<string>();
  const [problem, setProblem] = useState<string>();

  useEffect(() => {
    let current = true;
    const timer = setTimeout(() => {
      listIngredients(q).then(
        (found) => current && (setIngredients(found), setProblem(undefined)),
        (error: Error) => current && setProblem(error.message),
      );
    }, 150);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [q]);

  const saved = (ingredient: Ingredient) => {
    setIngredients((list) => list?.map((old) => (old.id === ingredient.id ? ingredient : old)));
    setEditing(undefined);
  };

  return (
    <section className="ingredients">
      <nav className="bar">
        <a className="back" href="#/recipes" aria-label="Back to recipes">
          ←
        </a>
        <h2>Ingredients</h2>
        <span />
      </nav>
      <p className="hint">Where each one is in the shop, how big a pack is, and what you always have at home.</p>
      <input type="search" className="search" placeholder="Search ingredients" aria-label="Search ingredients" value={q} onChange={(event) => setQ(event.target.value)} />
      {problem && <p role="alert">{problem}</p>}
      {ingredients && ingredients.length === 0 && <p className="hint">{q ? `No ingredient matches "${q}".` : "No ingredients yet. They get added when you save a recipe."}</p>}
      <ul className="ingredient-rows">
        {ingredients?.map((ingredient) =>
          editing === ingredient.id ? (
            <li key={ingredient.id}>
              <IngredientForm ingredient={ingredient} onSaved={saved} onCancel={() => setEditing(undefined)} />
            </li>
          ) : (
            <li key={ingredient.id}>
              <button type="button" className="ingredient-row" aria-label={`Edit ${ingredient.name}`} onClick={() => setEditing(ingredient.id)}>
                <strong>{ingredient.name}</strong>
                <span className="stickers">
                  <span className={`sticker ${sectionColour[ingredient.shopSection]}`}>{ingredient.shopSection}</span>
                  {ingredient.packAmount !== null && (
                    <span className="sticker white">
                      Pack {ingredient.packAmount} {ingredient.packUnit}
                    </span>
                  )}
                  {ingredient.alwaysAtHome && <span className="sticker mint">Always at home</span>}
                </span>
              </button>
            </li>
          ),
        )}
      </ul>
    </section>
  );
}

function IngredientForm({ ingredient, onSaved, onCancel }: { ingredient: Ingredient; onSaved: (ingredient: Ingredient) => void; onCancel: () => void }) {
  const [shopSection, setShopSection] = useState(ingredient.shopSection);
  const [packAmount, setPackAmount] = useState(ingredient.packAmount === null ? "" : String(ingredient.packAmount));
  const [packUnit, setPackUnit] = useState<string>(ingredient.packUnit ?? "g");
  const [alwaysAtHome, setAlwaysAtHome] = useState(ingredient.alwaysAtHome);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string>();

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const amount = packAmount.trim() === "" ? null : Number(packAmount.replace(",", "."));
    if (Number.isNaN(amount)) return setProblem("The pack size must be a number above 0.");
    setBusy(true);
    setProblem(undefined);
    try {
      onSaved(await saveIngredient(ingredient.id, { shopSection, packAmount: amount, packUnit: amount === null ? null : (packUnit as Ingredient["packUnit"]), alwaysAtHome }));
    } catch (error) {
      setProblem((error as Error).message);
      setBusy(false);
    }
  };

  return (
    <form className="ingredient-form" onSubmit={save} aria-label={`Settings for ${ingredient.name}`}>
      <strong>{ingredient.name}</strong>
      <label>
        Shop section
        <select value={shopSection} onChange={(event) => setShopSection(event.target.value as ShopSection)}>
          {shopSections.map((section) => (
            <option key={section}>{section}</option>
          ))}
        </select>
      </label>
      <fieldset>
        <legend>Pack size (if you like)</legend>
        <div className="pack">
          <input inputMode="decimal" aria-label="Pack amount" placeholder="e.g. 1" value={packAmount} onChange={(event) => setPackAmount(event.target.value)} />
          <select aria-label="Pack unit" value={packUnit} onChange={(event) => setPackUnit(event.target.value)}>
            {units.map((unit) => (
              <option key={unit}>{unit}</option>
            ))}
          </select>
        </div>
      </fieldset>
      <label className="check">
        <input type="checkbox" checked={alwaysAtHome} onChange={(event) => setAlwaysAtHome(event.target.checked)} />
        Always at home (never on the shopping list)
      </label>
      {problem && <p role="alert">{problem}</p>}
      <div className="row">
        <button type="button" className="ink-button white" onClick={onCancel}>
          Cancel
        </button>
        <button type="submit" className="ink-button" disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
    </form>
  );
}
