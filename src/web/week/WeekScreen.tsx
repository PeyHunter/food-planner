import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { mainTypes, type RecipeSummary } from "../../shared/recipes.ts";
import type { RuleOp } from "../../shared/rules.ts";
import { addDays, mondayOf, weekdayName, type Child, type WeekDay, type WeekRule, type WeekView } from "../../shared/week.ts";
import { listRecipes, today } from "../recipes/api.ts";
import { acceptSuggestion, addRule, deleteRule, getWeek, setChildDay, setDinner, setPeople, updateRule, type RuleInput } from "./api.ts";
import "./week.css";

type Picking = { date: string; childId: string | null };

const typeColour: Record<string, string> = { Fish: "sky", Meat: "tomato", Chicken: "sun", Vegetarian: "mint", Vegetables: "mint" };
const utc = (date: string) => new Date(`${date}T00:00:00Z`);
const short = (date: string, parts: Intl.DateTimeFormatOptions) => utc(date).toLocaleDateString("en-GB", { ...parts, timeZone: "UTC" });

/** ISO week number: the week that holds the year's first Thursday is week 1. */
function weekNumber(monday: string) {
  const thursday = utc(addDays(monday, 3));
  const yearStart = Date.UTC(thursday.getUTCFullYear(), 0, 1);
  return Math.floor((thursday.getTime() - yearStart) / 86_400_000 / 7) + 1;
}

function weekRange(monday: string) {
  const sunday = addDays(monday, 6);
  const sameMonth = monday.slice(0, 7) === sunday.slice(0, 7);
  return `${short(monday, sameMonth ? { day: "numeric" } : { day: "numeric", month: "short" })} – ${short(sunday, { day: "numeric", month: "short" })}`;
}

export function WeekScreen() {
  const [monday, setMonday] = useState(() => mondayOf(today()));
  const [view, setView] = useState<WeekView>();
  const [problem, setProblem] = useState<string>();
  const [picking, setPicking] = useState<Picking>();
  const [editingRules, setEditingRules] = useState(false);

  const load = useCallback(async () => {
    try {
      const week = await getWeek(monday);
      setView((current) => (week.monday === monday || !current ? week : current));
      setProblem(undefined);
    } catch (error) {
      setProblem((error as Error).message);
    }
  }, [monday]);

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

  const shown = view?.monday === monday ? view : undefined;
  const nameOf = (childId: string | null) => (childId === null ? "Adults" : (shown?.children.find((child) => child.id === childId)?.name ?? ""));

  return (
    <section className="week">
      <div className="wk">
        <button type="button" className="nav" aria-label="Previous week" onClick={() => setMonday(addDays(monday, -7))}>
          ←
        </button>
        <div className="wk-title">
          <h2>Week {weekNumber(monday)}</h2>
          <p>{weekRange(monday)}</p>
        </div>
        <button type="button" className="nav" aria-label="Next week" onClick={() => setMonday(addDays(monday, 7))}>
          →
        </button>
      </div>
      {problem && <p role="alert">{problem}</p>}
      {shown && (
        <>
          <RulesCard view={shown} onEdit={() => setEditingRules(true)} />
          {shown.suggestions.length > 0 && (
            <section className="swaps" aria-label="Ideas to meet the rules">
              <h3>Ideas to meet the rules</h3>
              <ul>
                {shown.suggestions.map((suggestion) => (
                  <li key={suggestion.id}>
                    <p>{suggestion.text}</p>
                    <button type="button" className="btn small mint" aria-label={`Do it: ${suggestion.text}`} onClick={() => act(() => acceptSuggestion(suggestion.id))}>
                      Do it
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <ol className="days">
            {shown.days.map((day, index) => (
              <DayCard
                key={day.date}
                day={day}
                index={index}
                kids={shown.children}
                onPick={(childId) => setPicking({ date: day.date, childId })}
                onPeople={(people) => act(() => setPeople(day.date, people))}
              />
            ))}
          </ol>
          {picking && (
            <Picker
              picking={picking}
              view={shown}
              who={nameOf(picking.childId)}
              onClose={() => setPicking(undefined)}
              onChoose={(change) => {
                setPicking(undefined);
                void act(change);
              }}
            />
          )}
          {editingRules && <RulesEditor view={shown} onChange={act} onClose={() => setEditingRules(false)} />}
        </>
      )}
    </section>
  );
}

function RulesCard({ view, onEdit }: { view: WeekView; onEdit: () => void }) {
  const groups: { id: string | null; name: string }[] = [{ id: null, name: "Adults" }, ...view.children];
  const toGo = view.rules.filter((rule) => !rule.met).length;
  return (
    <section className="rules-card" aria-labelledby="rules-title">
      <div className="head">
        <h2 id="rules-title">Rules</h2>
        <span className={`sticker ${toGo ? "tomato" : "mint"} tilt-r`}>{toGo ? `${toGo} to go` : "All met"}</span>
        <button type="button" className="btn small white end" onClick={onEdit}>
          Edit rules
        </button>
      </div>
      <div className="rule-groups">
        {groups.map((group) => (
          <div key={group.id ?? "adults"} className={group.id ? "kid-rules" : ""}>
            <h3>{group.name}</h3>
            <ul>
              {view.rules
                .filter((rule) => rule.childId === group.id)
                .map((rule) => (
                  <RuleLine key={rule.id} rule={rule} />
                ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function RuleLine({ rule }: { rule: WeekRule }) {
  const label = rule.op === "at-least" ? rule.what : `${rule.what} ≤ ${rule.n}`;
  return (
    <li className={rule.met ? "met" : "warn"} title={rule.sentence}>
      <span className="box" aria-hidden="true">
        {rule.met ? "✓" : "!"}
      </span>
      <span className="what">{label}</span>
      <span className="count" aria-label={`${rule.sentence}: ${rule.count} so far, ${rule.met ? "met" : "not met yet"}`}>
        {rule.count}/{rule.n}
      </span>
    </li>
  );
}

function Stickers({ recipe }: { recipe: Pick<RecipeSummary, "types" | "tags"> }) {
  return (
    <span className="stickers">
      {recipe.types.map((type, index) => (
        <span key={type} className={`sticker ${typeColour[type] ?? "sun"} ${index % 2 ? "tilt-r" : "tilt-l"}`}>
          {type}
        </span>
      ))}
      {recipe.tags.map((tag) => (
        <span key={tag} className="sticker white">
          {tag}
        </span>
      ))}
    </span>
  );
}

function Plate({ recipe }: { recipe: RecipeSummary }) {
  return recipe.mainPhoto ? <img className="plate" src={recipe.mainPhoto.url} alt="" loading="lazy" /> : <span className="plate none" aria-hidden="true" />;
}

type DayCardProps = { day: WeekDay; index: number; kids: Child[]; onPick: (childId: string | null) => void; onPeople: (people: number) => void };

function DayCard({ day, index, kids, onPick, onPeople }: DayCardProps) {
  const weekday = weekdayName(day.date);
  const isToday = day.date === today();
  return (
    <li className={`day${isToday ? " today" : ""}`} style={{ "--c": `var(--day-${index + 1})` } as CSSProperties} aria-label={weekday}>
      <div className="dn">
        <small>{short(day.date, { weekday: "short" })}</small>
        <b>{short(day.date, { day: "numeric" })}</b>
      </div>
      <div className="day-body">
        <div className="dinner">
          {isToday && <span className="sticker sun tilt-l next">Next up</span>}
          <button type="button" className={`dish${day.dinner ? "" : " empty"}`} onClick={() => onPick(null)}>
            {day.dinner ? (
              <>
                <Plate recipe={day.dinner} />
                <span className="dish-text">
                  <strong>{day.dinner.title}</strong>
                  <Stickers recipe={day.dinner} />
                </span>
              </>
            ) : (
              <span className="pick">+ Pick a dinner</span>
            )}
          </button>
          <div className="ppl" role="group" aria-label={`People on ${weekday}`}>
            <button type="button" aria-label={`One less person on ${weekday}`} disabled={day.people <= 1} onClick={() => onPeople(day.people - 1)}>
              −
            </button>
            <span className="n">
              <span aria-hidden="true">👥</span> {day.people}
              <span className="sr"> people</span>
              {day.extraPortions > 0 && <small> +{day.extraPortions === 0.5 ? "½" : day.extraPortions}</small>}
            </span>
            <button type="button" aria-label={`One more person on ${weekday}`} disabled={day.people >= 50} onClick={() => onPeople(day.people + 1)}>
              +
            </button>
          </div>
        </div>
        {kids.map((kid) => {
          const meal = day.children.find((entry) => entry.childId === kid.id);
          const text = meal?.kind === "same-as-dinner" ? "Same as dinner, mashed" : meal?.kind === "recipe" && meal.recipe ? meal.recipe.title : "Nothing yet";
          return (
            <button key={kid.id} type="button" className={`kid${meal?.kind === "empty" || !meal ? " nothing" : ""}`} onClick={() => onPick(kid.id)}>
              <span aria-hidden="true">🧒</span>
              <b>{kid.name}</b>
              <span className="meal">{text}</span>
              {meal?.kind === "same-as-dinner" && <span className="plus">+½</span>}
            </button>
          );
        })}
      </div>
    </li>
  );
}

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    if (ref.current && !ref.current.open) ref.current.showModal();
  }, []);
  return (
    <dialog ref={ref} className="sheet" aria-label={title} onClose={onClose}>
      <div className="sheet-head">
        <h2>{title}</h2>
        <button type="button" className="btn small white" onClick={onClose}>
          Close
        </button>
      </div>
      {children}
    </dialog>
  );
}

type PickerProps = { picking: Picking; view: WeekView; who: string; onClose: () => void; onChoose: (change: () => Promise<unknown>) => void };

function Picker({ picking, view, who, onClose, onChoose }: PickerProps) {
  const { date, childId } = picking;
  const [q, setQ] = useState("");
  const [found, setFound] = useState<RecipeSummary[]>();
  const day = view.days.find((entry) => entry.date === date)!;
  const weekday = weekdayName(date);

  useEffect(() => {
    if (childId !== null) return;
    let current = true;
    const timer = setTimeout(() => listRecipes(q).then((recipes) => current && setFound(recipes), () => current && setFound([])), 150);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [q, childId]);

  const recipes = childId === null ? found : view.childRecipes.filter((recipe) => recipe.title.toLowerCase().includes(q.trim().toLowerCase()));
  const choose = (recipeId: string) => onChoose(() => (childId === null ? setDinner(date, recipeId) : setChildDay(date, childId, "recipe", recipeId)));

  return (
    <Sheet title={childId === null ? `Dinner for ${weekday}` : `${who} on ${weekday}`} onClose={onClose}>
      <input type="search" className="search" placeholder="Search recipes" aria-label="Search recipes" value={q} onChange={(event) => setQ(event.target.value)} />
      <div className="sheet-actions">
        {childId !== null && (
          <>
            <button type="button" className="btn small lilac" onClick={() => onChoose(() => setChildDay(date, childId, "same-as-dinner"))}>
              Same as dinner, mashed
            </button>
            <button type="button" className="btn small white" onClick={() => onChoose(() => setChildDay(date, childId, "empty"))}>
              Nothing yet
            </button>
          </>
        )}
        {childId === null && day.dinner && (
          <button type="button" className="btn small white" onClick={() => onChoose(() => setDinner(date, null))}>
            No dinner
          </button>
        )}
      </div>
      {recipes && recipes.length === 0 && (
        <p className="hint">{childId === null ? "No recipe matches." : `No recipes for ${who} yet. Tag a recipe "for Runi" or give it an age range.`}</p>
      )}
      <ul className="pick-list">
        {recipes?.map((recipe) => (
          <li key={recipe.id}>
            <button type="button" onClick={() => choose(recipe.id)}>
              <Plate recipe={recipe} />
              <span className="dish-text">
                <strong>{recipe.title}</strong>
                <Stickers recipe={recipe} />
              </span>
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

const ruleWhats = [...mainTypes, "Freezable", "kid-friendly"];

function RulesEditor({ view, onChange, onClose }: { view: WeekView; onChange: (change: () => Promise<unknown>) => Promise<void>; onClose: () => void }) {
  return (
    <Sheet title="Edit rules" onClose={onClose}>
      <p className="hint">Each rule counts the dinners (or the child's meals) in one week.</p>
      <ul className="rule-rows">
        {view.rules.map((rule, index) => (
          <RuleRow key={rule.id} rule={rule} n={index + 1} kids={view.children} onChange={onChange} />
        ))}
      </ul>
      <button type="button" className="btn small sun" onClick={() => onChange(() => addRule({ childId: null, op: "at-least", n: 1, what: "Fish" }))}>
        + Add a rule
      </button>
    </Sheet>
  );
}

function RuleRow({ rule, n, kids, onChange }: { rule: WeekRule; n: number; kids: Child[]; onChange: (change: () => Promise<unknown>) => Promise<void> }) {
  // Kept here too, so a second change made before the week reloads doesn't undo the first.
  const [draft, setDraft] = useState<RuleInput>({ childId: rule.childId, op: rule.op, n: rule.n, what: rule.what });
  const save = (patch: Partial<RuleInput>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    void onChange(() => updateRule(rule.id, next));
  };
  const whats = ruleWhats.includes(draft.what) ? ruleWhats : [...ruleWhats, draft.what];
  return (
    <li>
      <select aria-label={`Who ${n}`} value={draft.childId ?? ""} onChange={(event) => save({ childId: event.target.value || null })}>
        <option value="">Adults</option>
        {kids.map((kid) => (
          <option key={kid.id} value={kid.id}>
            {kid.name}
          </option>
        ))}
      </select>
      <span>:</span>
      <select aria-label={`What ${n}`} value={draft.what} onChange={(event) => save({ what: event.target.value })}>
        {whats.map((what) => (
          <option key={what}>{what}</option>
        ))}
      </select>
      <select aria-label={`At least or at most ${n}`} value={draft.op} onChange={(event) => save({ op: event.target.value as RuleOp })}>
        <option value="at-least">at least</option>
        <option value="at-most">at most</option>
      </select>
      <select aria-label={`How many ${n}`} value={draft.n} onChange={(event) => save({ n: Number(event.target.value) })}>
        {Array.from({ length: 8 }, (_, count) => (
          <option key={count}>{count}</option>
        ))}
      </select>
      <span>a week</span>
      <button type="button" className="remove" aria-label={`Remove rule: ${rule.sentence}`} onClick={() => onChange(() => deleteRule(rule.id))}>
        ✕
      </button>
    </li>
  );
}
