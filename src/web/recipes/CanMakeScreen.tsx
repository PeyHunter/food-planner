import { useEffect, useState, type FormEvent } from "react";
import { t } from "../i18n.ts";
import type { CanMake } from "../../shared/can-make.ts";
import type { IngredientSuggestion } from "../../shared/recipes.ts";
import { findMakeable, suggestIngredients } from "./api.ts";

/** Type what is in the kitchen and see every recipe, nearest to cookable first. */
export function CanMakeScreen() {
  const [have, setHave] = useState<string[]>([]);
  const [typed, setTyped] = useState("");
  const [suggestions, setSuggestions] = useState<IngredientSuggestion[]>([]);
  const [focused, setFocused] = useState(false);
  const [results, setResults] = useState<CanMake[]>();
  const [problem, setProblem] = useState<string>();
  const [busy, setBusy] = useState(false);

  const q = typed.trim();
  const alreadyHave = (name: string) => have.some((item) => item.toLowerCase() === name.trim().toLowerCase());

  useEffect(() => {
    if (!focused || !q) return setSuggestions([]);
    let current = true;
    const timer = setTimeout(() => {
      suggestIngredients(q).then(
        (found) => current && setSuggestions(found.filter((item) => !alreadyHave(item.name) && item.name.toLowerCase() !== q.toLowerCase())),
        () => {},
      );
    }, 120);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [q, focused, have]);

  const add = (name: string) => {
    const value = name.trim();
    if (!value) return;
    if (!alreadyHave(value)) setHave((list) => [...list, value]);
    setTyped("");
    setSuggestions([]);
  };

  const remove = (name: string) => {
    setHave((list) => list.filter((item) => item !== name));
    setResults(undefined);
  };

  const find = async (event: FormEvent) => {
    event.preventDefault();
    const value = typed.trim();
    const list = value && !alreadyHave(value) ? [...have, value] : have;
    if (!list.length) return;
    if (value) {
      setHave(list);
      setTyped("");
    }
    setBusy(true);
    setProblem(undefined);
    try {
      setResults(await findMakeable(list));
    } catch (error) {
      setProblem((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="can-make">
      <nav className="bar">
        <a className="back" href="#/recipes" aria-label={t("Back to recipes")}>
          ←
        </a>
        <h2>{t("What can I make?")}</h2>
        <span />
      </nav>
      <p className="hint">{t("Type the ingredients you have. Recipes with the least missing come first.")}</p>

      <form className="can-make-search" onSubmit={find}>
        <div className="suggest-wrap">
          <input
            type="search"
            aria-label={t("Ingredient you have")}
            placeholder={t("Type an ingredient")}
            autoComplete="off"
            value={typed}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            onChange={(event) => setTyped(event.target.value)}
          />
          {suggestions.length > 0 && (
            <ul className="suggest" aria-label={t("Ingredient suggestions")}>
              {suggestions.map((item) => (
                <li key={item.id}>
                  {/* mousedown would blur the field and hide the list before the tap lands */}
                  <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => add(item.name)}>
                    {item.name}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <button type="button" className="ink-button white small" onClick={() => add(typed)} disabled={!typed.trim()}>
          {t("Add")}
        </button>
        <button type="submit" className="ink-button" disabled={busy || (!have.length && !typed.trim())}>
          {busy ? t("Looking…") : t("Find recipes")}
        </button>
      </form>

      {have.length > 0 && (
        <div className="chips" role="group" aria-label={t("Ingredients you have")}>
          {have.map((name) => (
            <button key={name} type="button" className="chip" aria-pressed="true" aria-label={t("Remove {name}", { name })} onClick={() => remove(name)}>
              {name} ×
            </button>
          ))}
        </div>
      )}

      {problem && <p role="alert">{problem}</p>}
      {results && results.length === 0 && <p className="hint">{t("No recipes yet. Add one and its ingredients first.")}</p>}
      {results && results.length > 0 && (
        <ul className="can-make-results">
          {results.map(({ recipe, missing }) => (
            <li key={recipe.id}>
              <a className="can-make-photo" href={`#/recipes/${recipe.id}`} tabIndex={-1} aria-hidden="true">
                {recipe.mainPhoto ? <img src={recipe.mainPhoto.url} alt="" loading="lazy" /> : <span className="no-photo" />}
              </a>
              <div className="can-make-text">
                <a href={`#/recipes/${recipe.id}`}>
                  <strong>{recipe.title}</strong>
                </a>
                {recipe.types.length > 0 && (
                  <span className="stickers">
                    {recipe.types.map((type) => (
                      <span key={type} className="sticker sun">
                        {t(type)}
                      </span>
                    ))}
                  </span>
                )}
                {missing.length === 0 ? (
                  <p className="can-make-now">{t("You can make this now")}</p>
                ) : (
                  <p className="can-make-missing">{t("You need: {list}", { list: missing.join(", ") })}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
