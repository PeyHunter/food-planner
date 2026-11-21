import { useCallback, useEffect, useState, type FormEvent } from "react";
import { currentLanguage, locale, t } from "../i18n.ts";
import { ageInWords, ageRangeLabel } from "../../shared/child-age.ts";
import type { ChildRecipe, ChildRecipes, ChildView } from "../../shared/children.ts";
import { mainTypes } from "../../shared/recipes.ts";
import type { RuleOp } from "../../shared/rules.ts";
import { childRecipeTag, mondayOf, type WeekRule } from "../../shared/week.ts";
import { today } from "../recipes/api.ts";
import { addRule, deleteRule, getWeek, updateRule, type RuleInput } from "../week/api.ts";
import { addChild, getChildRecipes, getChildren, updateChild } from "./api.ts";
import "./kids.css";

const ruleWhats = [...mainTypes, "Freezable", "kid-friendly"];
const longDate = (day: string) => new Date(`${day}T12:00:00`).toLocaleDateString(locale(), { day: "numeric", month: "long", year: "numeric" });
const ruleText = (rule: Pick<RuleInput, "op" | "n" | "what">) =>
  t(rule.op === "at-least" ? "{what} at least {n} a week" : "{what} at most {n} a week", { what: t(rule.what), n: rule.n });

/** The "Runi & kids" tab: one child at a time, with age, birthday, rules and the recipes that fit. */
export function KidsScreen() {
  const [kids, setKids] = useState<ChildView[]>();
  const [chosen, setChosen] = useState<string>();
  const [adding, setAdding] = useState(false);
  const [problem, setProblem] = useState<string>();

  const load = useCallback(async () => {
    try {
      setKids(await getChildren());
      setProblem(undefined);
    } catch (error) {
      setProblem((error as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const kid = kids?.find((entry) => entry.id === chosen) ?? kids?.[0];

  return (
    <section className="kids">
      <h2 className="kids-title">{t("Runi & kids")}</h2>
      <div className="chips" role="group" aria-label="Pick a child">
        {kids?.map((entry) => (
          <button key={entry.id} type="button" className="chip" aria-pressed={!adding && entry.id === kid?.id} onClick={() => (setChosen(entry.id), setAdding(false))}>
            🧒 {entry.name}
          </button>
        ))}
        <button type="button" className="chip" aria-pressed={adding} onClick={() => setAdding(true)}>
          {t("+ Add a child")}
        </button>
      </div>
      {problem && <p role="alert">{problem}</p>}
      {adding ? (
        <AddChild
          onAdded={async (id) => {
            await load();
            setChosen(id);
            setAdding(false);
          }}
          onCancel={() => setAdding(false)}
        />
      ) : (
        kid && <ChildPage key={kid.id} kid={kid} onChanged={load} />
      )}
    </section>
  );
}

function AddChild({ onAdded, onCancel }: { onAdded: (id: string) => Promise<void>; onCancel: () => void }) {
  const [problem, setProblem] = useState<string>();
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const { id } = await addChild({ name: String(form.get("name") ?? ""), birthday: String(form.get("birthday") ?? "") || null });
      await onAdded(id);
    } catch (error) {
      setProblem((error as Error).message);
    }
  };
  return (
    <form className="card kid-card" onSubmit={submit} aria-label="Add a child">
      <h2>{t("Add a child")}</h2>
      <label>
        {t("Name")}
        <input name="name" required maxLength={60} autoComplete="off" />
      </label>
      <label>
        {t("Birthday")}
        <input name="birthday" type="date" max={today()} />
      </label>
      {problem && <p role="alert">{problem}</p>}
      <div className="actions">
        <button type="submit" className="btn lilac">
          {t("Add child")}
        </button>
        <button type="button" className="btn white" onClick={onCancel}>
          {t("Cancel")}
        </button>
      </div>
    </form>
  );
}

function ChildPage({ kid, onChanged }: { kid: ChildView; onChanged: () => Promise<void> }) {
  const [recipes, setRecipes] = useState<ChildRecipes>();
  const [problem, setProblem] = useState<string>();

  useEffect(() => {
    getChildRecipes(kid.id).then(setRecipes, (error: Error) => setProblem(error.message));
  }, [kid.id, kid.ageMonths]);

  const newRecipe = `#/recipes/new?tag=${encodeURIComponent(childRecipeTag)}${kid.ageMonths === null ? "" : `&from=${kid.ageMonths}`}`;

  return (
    <>
      {problem && <p role="alert">{problem}</p>}
      <a className="btn lilac new-recipe" href={newRecipe}>
        {t("+ New recipe for {name}", { name: kid.name })}
      </a>
      {recipes && (
        <>
          <section className="kid-recipes" aria-labelledby="hers-title">
            <h2 id="hers-title">{t("{name}'s recipes", { name: kid.name })}</h2>
            {recipes.hers.length ? (
              <RecipeCards recipes={recipes.hers} label={`${kid.name}'s recipes`} />
            ) : (
              <p className="hint">{t('None for her age yet. Tag a recipe "{tag}" and it shows here.', { tag: childRecipeTag })}</p>
            )}
          </section>
          <section className="kid-recipes" aria-labelledby="fits-title">
            <h2 id="fits-title">{t("Also fits {name}'s age", { name: kid.name })}</h2>
            {kid.ageMonths === null ? (
              <p className="hint">{t("Set the birthday above to see which recipes fit.")}</p>
            ) : recipes.fitsAge.length ? (
              <RecipeCards recipes={recipes.fitsAge} label={`Also fits ${kid.name}'s age`} />
            ) : (
              <p className="hint">{t("No other recipe for {age} yet. Give a recipe an age range and it shows here.", { age: ageInWords(kid.ageMonths, currentLanguage()) })}</p>
            )}
          </section>
        </>
      )}
      {/* Her recipes come first; her details and rules sit below them. */}
      <AboutCard kid={kid} onChanged={onChanged} />
      <RulesCard kid={kid} />
    </>
  );
}

function AboutCard({ kid, onChanged }: { kid: ChildView; onChanged: () => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [problem, setProblem] = useState<string>();

  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await updateChild(kid.id, { name: String(form.get("name") ?? ""), birthday: String(form.get("birthday") ?? "") || null });
      await onChanged();
      setEditing(false);
      setProblem(undefined);
    } catch (error) {
      setProblem((error as Error).message);
    }
  };

  return (
    <section className="card kid-card" aria-label={`About ${kid.name}`}>
      <span className="sticker lilac tilt-l age" aria-hidden="true">
        🧒
      </span>
      <h2>{kid.name}</h2>
      <p className="age-words">{kid.ageMonths === null ? t("Age not known yet") : t("{age} old", { age: ageInWords(kid.ageMonths, currentLanguage()) })}</p>
      {editing ? (
        <form className="kid-edit" onSubmit={save}>
          <label>
            {t("Name")}
            <input name="name" required maxLength={60} defaultValue={kid.name} />
          </label>
          <label>
            {t("Birthday")}
            <input name="birthday" type="date" max={today()} defaultValue={kid.birthday ?? ""} />
          </label>
          {problem && <p role="alert">{problem}</p>}
          <div className="actions">
            <button type="submit" className="btn small lilac">
              {t("Save")}
            </button>
            <button type="button" className="btn small white" onClick={() => setEditing(false)}>
              {t("Cancel")}
            </button>
          </div>
        </form>
      ) : (
        <p className="birthday">
          {kid.birthday ? t("Birthday: {date}", { date: longDate(kid.birthday) }) : t("No birthday yet.")}
          <button type="button" className="btn small white" onClick={() => setEditing(true)}>
            {kid.birthday ? t("Edit") : t("Set birthday")}
          </button>
        </p>
      )}
      <label className="toggle">
        <input
          type="checkbox"
          role="switch"
          checked={kid.sameAsDinnerByDefault}
          onChange={async (event) => {
            try {
              await updateChild(kid.id, { name: kid.name, birthday: kid.birthday, sameAsDinnerByDefault: event.target.checked });
              await onChanged();
            } catch (error) {
              setProblem((error as Error).message);
            }
          }}
        />
        <span>{t("Eats the same as the grown-ups by default")}</span>
      </label>
      <p className="hint">{t("Every day with a dinner gives {name} the same dinner, unless you pick something else for that day.", { name: kid.name })}</p>
      {!editing && problem && <p role="alert">{problem}</p>}
    </section>
  );
}

function RulesCard({ kid }: { kid: ChildView }) {
  const [rules, setRules] = useState<WeekRule[]>();
  const [editing, setEditing] = useState(false);
  const [problem, setProblem] = useState<string>();

  const load = useCallback(async () => {
    try {
      const week = await getWeek(mondayOf(today()));
      setRules(week.rules.filter((rule) => rule.childId === kid.id));
      setProblem(undefined);
    } catch (error) {
      setProblem((error as Error).message);
    }
  }, [kid.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = async (change: () => Promise<unknown>) => {
    try {
      await change();
    } catch (error) {
      setProblem((error as Error).message);
    }
    await load();
  };

  return (
    <section className="card kid-rules" aria-labelledby="kid-rules-title">
      <div className="head">
        <h2 id="kid-rules-title">{t("{name}'s rules", { name: kid.name })}</h2>
        <button type="button" className="btn small white" onClick={() => setEditing(!editing)}>
          {editing ? t("Done") : t("Change rules")}
        </button>
      </div>
      <p className="hint">{t("Each rule counts {name}'s meals in one week. Progress is for this week.", { name: kid.name })}</p>
      {problem && <p role="alert">{problem}</p>}
      {rules && !rules.length && <p className="hint">{t("No rules yet.")}</p>}
      <ul className="big-rules">
        {rules?.map((rule) => (editing ? <RuleEditor key={rule.id} rule={rule} onChange={act} /> : <BigRule key={rule.id} rule={rule} />))}
      </ul>
      {editing && (
        <button type="button" className="btn small lilac" onClick={() => act(() => addRule({ childId: kid.id, op: "at-least", n: 1, what: "Fish" }))}>
          {t("+ Add a rule")}
        </button>
      )}
    </section>
  );
}

function progress(rule: WeekRule) {
  const values = { count: rule.count, n: rule.n, left: rule.n - rule.count };
  if (rule.op === "at-most") return t(rule.met ? "{count} so far this week" : "{count} this week, that's too many", values);
  if (rule.met) return t("Done this week: {count} of {n}", values);
  return t("{count} of {n} this week, {left} to go", values);
}

function BigRule({ rule }: { rule: WeekRule }) {
  return (
    <li className={rule.met ? "met" : "warn"}>
      <span className="box" aria-hidden="true">
        {rule.met ? "✓" : "!"}
      </span>
      <span>
        <strong>{ruleText(rule)}</strong>
        <small>{progress(rule)}</small>
      </span>
    </li>
  );
}

function RuleEditor({ rule, onChange }: { rule: WeekRule; onChange: (change: () => Promise<unknown>) => Promise<void> }) {
  // Kept here too, so a second change made before the rules reload doesn't undo the first.
  const [draft, setDraft] = useState<RuleInput>({ childId: rule.childId, op: rule.op, n: rule.n, what: rule.what });
  const save = (patch: Partial<RuleInput>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    void onChange(() => updateRule(rule.id, next));
  };
  const whats = ruleWhats.includes(draft.what) ? ruleWhats : [...ruleWhats, draft.what];
  const text = ruleText(draft);
  return (
    <li className="rule-edit">
      <select aria-label={`What: ${text}`} value={draft.what} onChange={(event) => save({ what: event.target.value })}>
        {whats.map((what) => (
          <option key={what} value={what}>
            {t(what)}
          </option>
        ))}
      </select>
      <select aria-label={`At least or at most: ${text}`} value={draft.op} onChange={(event) => save({ op: event.target.value as RuleOp })}>
        <option value="at-least">{t("at least")}</option>
        <option value="at-most">{t("at most")}</option>
      </select>
      <select aria-label={`How many: ${text}`} value={draft.n} onChange={(event) => save({ n: Number(event.target.value) })}>
        {Array.from({ length: 8 }, (_, count) => (
          <option key={count}>{count}</option>
        ))}
      </select>
      <span>{t("a week")}</span>
      <button type="button" className="remove" aria-label={`Remove rule: ${text}`} onClick={() => onChange(() => deleteRule(rule.id))}>
        ✕
      </button>
    </li>
  );
}

function RecipeCards({ recipes, label }: { recipes: ChildRecipe[]; label: string }) {
  return (
    <ul className="kid-recipe-list" aria-label={label}>
      {recipes.map((recipe) => (
        <li key={recipe.id}>
          <a href={`#/recipes/${recipe.id}`}>
            {recipe.mainPhoto ? <img src={recipe.mainPhoto.url} alt="" loading="lazy" /> : <span className="plate" aria-hidden="true" />}
            <strong>{recipe.title}</strong>
            {ageRangeLabel(recipe, currentLanguage()) && <span className="sticker lilac tilt-r">{ageRangeLabel(recipe, currentLanguage())}</span>}
          </a>
        </li>
      ))}
    </ul>
  );
}
