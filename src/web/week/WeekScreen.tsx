import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { locale, t } from "../i18n.ts";
import { useSheet } from "../sheet.ts";
import { kidTags, mainTypes, type MainType, type RecipeSummary } from "../../shared/recipes.ts";
import type { ReduceWaste as WasteIdea } from "../../shared/reduce-waste.ts";
import type { RuleOp } from "../../shared/rules.ts";
import { addDays, awayKinds, childRecipeTag, maxAwayNote, maxPeople, maxSides, mondayOf, weekdayName, type AwayKind, type Child, type CreatedWeek, type WeekDay, type WeekRule, type WeekView } from "../../shared/week.ts";
import { tagLabel } from "../kids/labels.ts";
import { useKids } from "../kitchen.ts";
import { listBookRecipes, today } from "../recipes/api.ts";
import { acceptSuggestion, addRule, addSide, createWeek, deleteRule, getWeek, reduceWaste, removeSide, setAway, setChildDay, setDinner, setPeople, undoCreateWeek, updateRule, type RuleInput } from "./api.ts";
import "./week.css";

/** side: adding another dish to the dinner rather than picking the dinner. */
type Picking = { date: string; childId: string | null; side?: true };

const awayLabel: Record<AwayKind, string> = { out: "Visiting others", takeout: "Takeout", other: "Something else" };
const awayIcon: Record<AwayKind, string> = { out: "🏠", takeout: "🥡", other: "✏️" };

const typeColour: Record<string, string> = { Fish: "sky", Meat: "tomato", Chicken: "sun", Vegetarian: "mint", Vegetables: "mint" };
const utc = (date: string) => new Date(`${date}T00:00:00Z`);
const short = (date: string, parts: Intl.DateTimeFormatOptions) => utc(date).toLocaleDateString(locale(), { ...parts, timeZone: "UTC" });

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
  // A recipe opened from the week links back with #/week?monday=..., so you land on the week you left.
  const [monday, setMonday] = useState(() => {
    const asked = new URLSearchParams(window.location.hash.split("?")[1] ?? "").get("monday");
    // Read once, then dropped from the address so a later reload opens this week as usual.
    if (asked) history.replaceState(null, "", "#/week");
    return asked && /^\d{4}-\d{2}-\d{2}$/.test(asked) ? mondayOf(asked) : mondayOf(today());
  });
  const [view, setView] = useState<WeekView>();
  const [problem, setProblem] = useState<string>();
  const [picking, setPicking] = useState<Picking>();
  const [editingRules, setEditingRules] = useState(false);
  const [open, setOpen] = useState(false);
  const loads = useRef(0);

  const load = useCallback(async () => {
    const mine = ++loads.current;
    try {
      const week = await getWeek(monday);
      if (mine !== loads.current) return;
      setView((current) => (week.monday === monday || !current ? week : current));
      setProblem(undefined);
    } catch (error) {
      if (mine === loads.current) setProblem((error as Error).message);
    }
  }, [monday]);
  const people = usePeople(load, setProblem);

  useEffect(() => {
    void load();
  }, [load]);
  // A sheet opened for a day of the week you just left closes with it.
  useEffect(() => setPicking(undefined), [monday]);

  const act = async (change: () => Promise<unknown>) => {
    try {
      await change();
    } catch (error) {
      setProblem((error as Error).message);
    }
    await load();
  };

  const shown = view?.monday === monday ? view : undefined;
  const nameOf = (childId: string | null) => (childId === null ? t("Adults") : (shown?.children.find((child) => child.id === childId)?.name ?? ""));

  return (
    <section className="week">
      <div className="wk">
        <button type="button" className="nav" aria-label="Previous week" onClick={() => setMonday(addDays(monday, -7))}>
          ←
        </button>
        <div className="wk-title">
          <h2>{t("Week {n}", { n: weekNumber(monday) })}</h2>
          <p>{weekRange(monday)}</p>
        </div>
        <button type="button" className="nav" aria-label="Next week" onClick={() => setMonday(addDays(monday, 7))}>
          →
        </button>
      </div>
      {problem && <p role="alert">{problem}</p>}
      {shown && (
        <>
          <ol className="days">
            {shown.days.map((day, index) => (
              <DayCard
                key={day.date}
                day={day}
                index={index}
                people={people.count(day)}
                kids={shown.children}
                onPick={(childId) => setPicking({ date: day.date, childId })}
                onAddSide={() => setPicking({ date: day.date, childId: null, side: true })}
                onRemoveSide={(position) => void act(() => removeSide(day.date, position))}
                onPeople={(step) => people.change(day, step)}
              />
            ))}
          </ol>
          <div className="week-bar">
            <button type="button" className="btn small sun" aria-expanded={open} aria-controls="week-suggestions" onClick={() => setOpen(!open)}>
              {t("Suggestions")}
              {shown.suggestions.length > 0 && (
                <span className="sticker tomato badge" aria-label={`${shown.suggestions.length} ideas to meet the rules`}>
                  {shown.suggestions.length}
                </span>
              )}
              <span aria-hidden="true">{open ? "▴" : "▾"}</span>
            </button>
            <a className="btn small white freezer-link" href="#/recipes/freezer">
              {t("❄ Freezer")}
              {shown.freezer.length > 0 && <span className="sticker sky">{shown.freezer.reduce((sum, item) => sum + item.count, 0)}</span>}
            </a>
          </div>
          <div id="week-suggestions" className="suggestions" hidden={!open}>
            <RulesCard view={shown} onEdit={() => setEditingRules(true)} />
            {shown.suggestions.length > 0 && (
              <section className="swaps" aria-label="Ideas to meet the rules">
                <h3>{t("Ideas to meet the rules")}</h3>
                <ul>
                  {shown.suggestions.map((suggestion) => (
                    <li key={suggestion.id} className={suggestion.childId ? "kid-idea" : undefined}>
                      <p>{suggestion.text}</p>
                      {suggestion.kind !== "note" && (
                        <div className="take-idea">
                          <small>{t("I love it")}</small>
                          <button type="button" className="btn small mint" aria-label={`Let's do it: ${suggestion.text}`} onClick={() => act(() => acceptSuggestion(suggestion.id))}>
                            {t("Let's do it")}
                          </button>
                        </div>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <div className="week-tools">
              <CreateWeek monday={monday} onDone={load} setProblem={setProblem} />
              <ReduceWaste monday={monday} onDone={load} setProblem={setProblem} />
            </div>
          </div>
          {picking && shown.days.some((day) => day.date === picking.date) && (
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

const peopleSaveDelay = 250;

/**
 * People counts change on screen at once. Quick taps are gathered, and only the newest count is sent, one save at a time.
 * The local count stays until a week loaded after the last save has it.
 */
function usePeople(load: () => Promise<void>, setProblem: (problem: string) => void) {
  const [drafts, setDrafts] = useState<Record<string, number>>({});
  const latest = useRef<Record<string, number>>({});
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const saving = useRef(Promise.resolve());
  // A save may finish after the user moved to another week; reload the week on screen then.
  const loadNow = useRef(load);
  loadNow.current = load;

  const count = (day: WeekDay) => drafts[day.date] ?? day.people;
  const change = (day: WeekDay, step: number) => {
    const { date } = day;
    const people = Math.min(maxPeople, Math.max(1, (latest.current[date] ?? day.people) + step));
    latest.current = { ...latest.current, [date]: people };
    setDrafts(latest.current);
    clearTimeout(timers.current.get(date));
    timers.current.set(
      date,
      setTimeout(() => {
        timers.current.delete(date);
        saving.current = saving.current.then(async () => {
          try {
            await setPeople(date, people);
          } catch (error) {
            setProblem((error as Error).message);
          }
          await loadNow.current();
          if (latest.current[date] !== people) return;
          const { [date]: _saved, ...rest } = latest.current;
          latest.current = rest;
          setDrafts(rest);
        });
      }, peopleSaveDelay),
    );
  };
  return { count, change };
}

/** An answer shows up below its button; on a phone that can be under the tab bar, so bring it into view. */
function useShowAnswer(answer: unknown) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (answer) ref.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [answer]);
  return ref;
}

/** Fills the empty days in one go, then says how the rules came out, with an undo for just that. */
function CreateWeek({ monday, onDone, setProblem }: { monday: string; onDone: () => Promise<void>; setProblem: (problem: string) => void }) {
  const [made, setMade] = useState<{ monday: string } & CreatedWeek>();
  const [busy, setBusy] = useState(false);
  const shown = made?.monday === monday ? made : undefined;
  const answer = useShowAnswer(shown);

  const run = async (change: () => Promise<void>) => {
    setBusy(true);
    try {
      await change();
    } catch (error) {
      setProblem((error as Error).message);
    }
    await onDone();
    setBusy(false);
  };
  const create = () => run(async () => setMade({ monday, ...(await createWeek(monday)) }));
  const undo = (week: CreatedWeek) =>
    run(async () => {
      await undoCreateWeek(monday, week.fills);
      setMade(undefined);
    });

  return (
    <section className="create-week" aria-label="Create week">
      <button type="button" className="btn sun" disabled={busy} onClick={create}>
        {t("Create week")}
      </button>
      <div role="status" ref={answer}>
        {shown && (
          <div className="created">
            <p>{shown.note}</p>
            {shown.fills.length > 0 && (
              <button type="button" className="btn small white" disabled={busy} onClick={() => undo(shown)}>
                {t("Undo")}
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

/** Gently suggests one swap that uses up a leftover. Accepting it changes one dinner; undo puts the old one back. */
function ReduceWaste({ monday, onDone, setProblem }: { monday: string; onDone: () => Promise<void>; setProblem: (problem: string) => void }) {
  const [idea, setIdea] = useState<{ monday: string; accepted: boolean } & WasteIdea>();
  const [busy, setBusy] = useState(false);
  const shown = idea?.monday === monday ? idea : undefined;
  const answer = useShowAnswer(shown);

  const run = async (change: () => Promise<void>, reload: boolean) => {
    setBusy(true);
    try {
      await change();
    } catch (error) {
      setProblem((error as Error).message);
    }
    if (reload) await onDone();
    setBusy(false);
  };
  const ask = () => run(async () => setIdea({ monday, accepted: false, ...(await reduceWaste(monday)) }), false);
  const accept = (swap: NonNullable<WasteIdea["swap"]>) =>
    run(async () => {
      await setDinner(swap.date, swap.recipeId);
      setIdea((current) => current && { ...current, accepted: true });
    }, true);
  const undo = (swap: NonNullable<WasteIdea["swap"]>) =>
    run(async () => {
      await setDinner(swap.date, swap.replaces);
      setIdea(undefined);
    }, true);

  return (
    <section className="reduce-waste" aria-label="Reduce waste">
      <button type="button" className="btn lilac" disabled={busy} onClick={ask}>
        {t("Reduce waste")}
      </button>
      <div role="status" ref={answer}>
        {shown && (
          <div className="waste-idea">
            <p>{shown.accepted ? t("Done. The week is updated.") : shown.text}</p>
            {shown.swap && !shown.accepted && (
              <div className="actions">
                <button type="button" className="btn small mint" disabled={busy} onClick={() => accept(shown.swap!)}>
                  {t("Accept")}
                </button>
                <button type="button" className="btn small white" disabled={busy} onClick={() => setIdea(undefined)}>
                  {t("Not now")}
                </button>
              </div>
            )}
            {shown.swap && shown.accepted && (
              <button type="button" className="btn small white" disabled={busy} onClick={() => undo(shown.swap!)}>
                {t("Undo")}
              </button>
            )}
            {!shown.swap && (
              <button type="button" className="btn small white" onClick={() => setIdea(undefined)}>
                {t("OK")}
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function RulesCard({ view, onEdit }: { view: WeekView; onEdit: () => void }) {
  const groups: { id: string | null; name: string }[] = [{ id: null, name: t("Adults") }, ...view.children];
  const toGo = view.rules.filter((rule) => !rule.met).length;
  return (
    <section className="rules-card" aria-labelledby="rules-title">
      <div className="head">
        <h2 id="rules-title">{t("Rules")}</h2>
        <span className={`sticker ${toGo ? "tomato" : "mint"} tilt-r`}>{toGo ? t("{n} to go", { n: toGo }) : t("All met")}</span>
        <button type="button" className="btn small white end" onClick={onEdit}>
          {t("Edit rules")}
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
  const label = rule.op === "at-least" ? t(rule.what) : `${t(rule.what)} ≤ ${rule.n}`;
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

function Stickers({ recipe, kids }: { recipe: Pick<RecipeSummary, "types" | "tags">; kids: string[] }) {
  return (
    <span className="stickers">
      {recipe.types.map((type, index) => (
        <span key={type} className={`sticker ${typeColour[type] ?? "sun"} ${index % 2 ? "tilt-r" : "tilt-l"}`}>
          {t(type)}
        </span>
      ))}
      {recipe.tags.map((tag) => (
        <span key={tag} className="sticker white">
          {tagLabel(tag, kids)}
        </span>
      ))}
    </span>
  );
}

function Plate({ recipe, big = false }: { recipe: RecipeSummary; big?: boolean }) {
  const kind = big ? "photo" : "plate";
  return recipe.mainPhoto ? <img className={kind} src={recipe.mainPhoto.url} alt="" loading="lazy" /> : <span className={`${kind} none`} aria-hidden="true" />;
}

type DayCardProps = {
  day: WeekDay;
  index: number;
  people: number;
  kids: Child[];
  onPick: (childId: string | null) => void;
  onPeople: (step: number) => void;
  onAddSide: () => void;
  onRemoveSide: (position: number) => void;
};

function DayCard({ day, index, people, kids, onPick, onPeople, onAddSide, onRemoveSide }: DayCardProps) {
  const weekday = weekdayName(day.date, locale());
  const isToday = day.date === today();
  return (
    <li className={`day${isToday ? " today" : ""}`} style={{ "--c": `var(--day-${index + 1})` } as CSSProperties} aria-label={weekday}>
      <div className="dn">
        <small>{short(day.date, { weekday: "short" })}</small>
        <b>{short(day.date, { day: "numeric" })}</b>
      </div>
      <div className="day-body">
        {isToday && <span className="sticker sun tilt-l next">{t("Next up")}</span>}
        <div className="dinner">
          {/* A planned dinner opens its recipe (steps, "I made this"); Change opens the picker. */}
          {day.dinner ? (
            <a className="dish" href={`#/recipes/${day.dinner.id}?week=${mondayOf(day.date)}`}>
              <Plate recipe={day.dinner} big />
              <span className="dish-text">
                <strong>{day.dinner.title}</strong>
                {day.fromFreezer && <span className="sticker sky tilt-r from-freezer">{t("❄ From the freezer")}</span>}
                <Stickers recipe={day.dinner} kids={kids.map((kid) => kid.name)} />
              </span>
            </a>
          ) : (
          <button type="button" className={`dish${day.away ? "" : " empty"}`} onClick={() => onPick(null)}>
            {day.away ? (
              <span className="dish-text away">
                <span className="away-icon" aria-hidden="true">
                  {awayIcon[day.away.kind]}
                </span>
                <strong>{day.away.note || t(awayLabel[day.away.kind])}</strong>
                {day.away.note && <span className="sticker white">{t(awayLabel[day.away.kind])}</span>}
              </span>
            ) : (
              <span className="pick">{t("+ Pick a dinner")}</span>
            )}
          </button>
          )}
          {day.dinner && (
            <button type="button" className="btn small white change" aria-label={`Change dinner on ${weekday}`} onClick={() => onPick(null)}>
              {t("Change")}
            </button>
          )}
          <div className="ppl" role="group" aria-label={`People on ${weekday}`}>
            <button type="button" aria-label={`One less person on ${weekday}`} disabled={people <= 1} onClick={() => onPeople(-1)}>
              −
            </button>
            <span className="n">
              <span aria-hidden="true">👥</span> {people}
              <span className="sr"> people</span>
              {day.extraPortions > 0 && <small> +{day.extraPortions === 0.5 ? "½" : day.extraPortions}</small>}
            </span>
            <button type="button" aria-label={`One more person on ${weekday}`} disabled={people >= maxPeople} onClick={() => onPeople(1)}>
              +
            </button>
          </div>
        </div>
        {day.dinner && (
          <ul className="sides" aria-label={`More dishes on ${weekday}`}>
            {day.sides.map(({ position, recipe }) => (
              <li key={position}>
                <Plate recipe={recipe} />
                <span>{recipe.title}</span>
                <button type="button" className="remove" aria-label={`Remove ${recipe.title} from ${weekday}`} onClick={() => onRemoveSide(position)}>
                  ✕
                </button>
              </li>
            ))}
            {day.sides.length < maxSides && (
              <li>
                <button type="button" className="add-side" onClick={onAddSide}>
                  {t("+ Add a dish (like a salad)")}
                </button>
              </li>
            )}
          </ul>
        )}
        {kids.map((kid) => {
          const meal = day.children.find((entry) => entry.childId === kid.id);
          const text = meal?.kind === "same-as-dinner" ? t("Same as dinner, mashed") : meal?.kind === "recipe" && meal.recipe ? meal.recipe.title : t("Nothing yet");
          return (
            <button key={kid.id} type="button" className={`kid${meal?.kind === "empty" || !meal ? " nothing" : ""}`} onClick={() => onPick(kid.id)}>
              <span aria-hidden="true">🧒</span>
              <b>{kid.name}</b>
              <span className="meal">{text}</span>
              {meal?.fromFreezer && <span className="sticker sky tilt-r from-freezer">{t("❄ From the freezer")}</span>}
              {meal?.kind === "same-as-dinner" && <span className="plus">+½</span>}
            </button>
          );
        })}
      </div>
    </li>
  );
}

/** The title and Close stay put; only the body scrolls. A tall sheet keeps one height, so it never jumps while its list filters. */
function Sheet({ title, tall = false, onClose, children }: { title: string; tall?: boolean; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useSheet(ref);
  return (
    <dialog ref={ref} className={`sheet${tall ? " tall" : ""}`} aria-label={title} tabIndex={-1} onClose={onClose}>
      <div className="sheet-head">
        <h2>{title}</h2>
        <button type="button" className="btn small white" onClick={onClose}>
          {t("Close")}
        </button>
      </div>
      <div className="sheet-body">{children}</div>
    </dialog>
  );
}

type PickerProps = { picking: Picking; view: WeekView; who: string; onClose: () => void; onChoose: (change: () => Promise<unknown>) => void };

function Picker({ picking, view, who, onClose, onChoose }: PickerProps) {
  const { date, childId, side } = picking;
  const day = view.days.find((entry) => entry.date === date)!;
  const [awayNote, setAwayNote] = useState(day.away?.note ?? "");
  const [q, setQ] = useState("");
  const [found, setFound] = useState<RecipeSummary[]>();
  const [type, setType] = useState<MainType>();
  const meal = childId === null ? undefined : day.children.find((entry) => entry.childId === childId);

  useEffect(() => {
    if (childId !== null) return;
    let current = true;
    const timer = setTimeout(() => listBookRecipes(q).then((recipes) => current && setFound(recipes), () => current && setFound([])), 150);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [q, childId]);

  const searched = childId === null ? found : view.childRecipes.filter((recipe) => recipe.title.toLowerCase().includes(q.trim().toLowerCase()));
  const recipes = type ? searched?.filter((recipe) => recipe.types.includes(type)) : searched;
  // Tapping what is already chosen takes it away again.
  const chosenId = (recipeId: string) =>
    side ? day.sides.some((entry) => entry.recipe.id === recipeId) : childId === null ? !day.fromFreezer && day.dinner?.id === recipeId : meal?.kind === "recipe" && !meal.fromFreezer && meal.recipe?.id === recipeId;
  const choose = (recipeId: string) => {
    if (side) {
      const chosen = day.sides.find((entry) => entry.recipe.id === recipeId);
      return onChoose(() => (chosen ? removeSide(date, chosen.position) : addSide(date, recipeId)));
    }
    if (childId !== null) return onChoose(() => (chosenId(recipeId) ? setChildDay(date, childId, "empty") : setChildDay(date, childId, "recipe", recipeId)));
    onChoose(() => setDinner(date, chosenId(recipeId) ? null : recipeId));
  };
  const title = t(side ? "Another dish for {day}" : childId === null ? "Dinner for {day}" : "{who} on {day}", { day: weekdayName(date, locale()), who });

  return (
    <Sheet title={title} tall onClose={onClose}>
      {childId === null && !side && (
        <section className="away-pick" aria-label="No cooking">
          <div className="sheet-actions">
            {awayKinds.map((kind) => (
              <button
                key={kind}
                type="button"
                className="btn small white"
                aria-pressed={day.away?.kind === kind}
                onClick={() => onChoose(() => (day.away?.kind === kind ? setDinner(date, null) : setAway(date, { kind, note: awayNote.trim() })))}
              >
                <span aria-hidden="true">{awayIcon[kind]}</span> {t(awayLabel[kind])}
              </button>
            ))}
          </div>
          <input
            className="search"
            aria-label="Note, like where you eat"
            placeholder={t("Note, like “At Isabel's” (optional)")}
            maxLength={maxAwayNote}
            value={awayNote}
            onChange={(event) => setAwayNote(event.target.value)}
          />
        </section>
      )}
      {childId !== null && !side && (view.childFreezer[childId]?.length ?? 0) > 0 && (
        <section className="freezer-pick kid-freezer-pick" aria-label={t("From {name}'s freezer", { name: who })}>
          <h3>{t("❄ From {name}'s freezer", { name: who })}</h3>
          <p className="hint">{t("Takes one portion out. Nothing goes on the shopping list.")}</p>
          <ul className="pick-list">
            {view.childFreezer[childId]!.map(({ recipe, count }) => {
              const chosen = meal?.fromFreezer === true && meal.recipe?.id === recipe.id;
              return (
                <li key={recipe.id}>
                  <button
                    type="button"
                    aria-label={t("From {name}'s freezer: {title}", { name: who, title: recipe.title })}
                    aria-pressed={chosen}
                    onClick={() => onChoose(() => (chosen ? setChildDay(date, childId, "empty") : setChildDay(date, childId, "recipe", recipe.id, true)))}
                  >
                    <Plate recipe={recipe} />
                    <span className="dish-text">
                      <strong>{recipe.title}</strong>
                      <span className="sticker sky">{t("{n} left", { n: count })}</span>
                    </span>
                    <Tick />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      <input type="search" className="search" placeholder={t("Search recipes")} aria-label="Search recipes" value={q} onChange={(event) => setQ(event.target.value)} />
      <div className="chips" role="group" aria-label="Filter by type">
        {[undefined, ...mainTypes].map((option) => (
          <button key={option ?? "all"} type="button" className="chip" aria-pressed={type === option} onClick={() => setType(type === option ? undefined : option)}>
            {option ? t(option) : t("All")}
          </button>
        ))}
      </div>
      <div className="sheet-actions">
        {childId !== null && (
          <>
            <button
              type="button"
              className="btn small lilac"
              disabled={!day.dinner}
              aria-pressed={meal?.kind === "same-as-dinner"}
              aria-describedby={day.dinner ? undefined : "no-dinner-hint"}
              onClick={() => onChoose(() => setChildDay(date, childId, meal?.kind === "same-as-dinner" ? "empty" : "same-as-dinner"))}
            >
              {t("Same as dinner, mashed")}
            </button>
            <button type="button" className="btn small white" aria-pressed={!meal || meal.kind === "empty"} onClick={() => onChoose(() => setChildDay(date, childId, "empty"))}>
              {t("Nothing yet")}
            </button>
            {!day.dinner && (
              <p id="no-dinner-hint" className="hint no-dinner">
                {t("Pick a dinner first")}
              </p>
            )}
          </>
        )}
        {childId === null && !side && (day.dinner || day.away) && (
          <button type="button" className="btn small white" onClick={() => onChoose(() => setDinner(date, null))}>
            {t("No dinner")}
          </button>
        )}
      </div>
      {childId === null && !side && view.freezer.length > 0 && (
        <section className="freezer-pick" aria-label="From the freezer">
          <h3>{t("❄ From the freezer")}</h3>
          <p className="hint">{t("Takes one portion out. Nothing goes on the shopping list.")}</p>
          <ul className="pick-list">
            {view.freezer.map(({ recipe, count }) => {
              const chosen = day.fromFreezer && day.dinner?.id === recipe.id;
              return (
                <li key={recipe.id}>
                  <button
                    type="button"
                    aria-label={`From the freezer: ${recipe.title}`}
                    aria-pressed={chosen}
                    onClick={() => onChoose(() => (chosen ? setDinner(date, null) : setDinner(date, recipe.id, true)))}
                  >
                    <Plate recipe={recipe} />
                    <span className="dish-text">
                      <strong>{recipe.title}</strong>
                      <span className="sticker sky">{t("{n} left", { n: count })}</span>
                    </span>
                    <Tick />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      {recipes && recipes.length === 0 && (
        <p className="hint">{childId === null || type ? t("No recipe matches.") : t('No recipes for {who} yet. Tag a recipe "{tag}" or give it an age range.', { who, tag: tagLabel(childRecipeTag, view.children.map((kid) => kid.name)) })}</p>
      )}
      <ul className="pick-list">
        {recipes?.map((recipe) => (
          <li key={recipe.id}>
            <button type="button" aria-pressed={chosenId(recipe.id)} onClick={() => choose(recipe.id)}>
              <Plate recipe={recipe} />
              <span className="dish-text">
                <strong>{recipe.title}</strong>
                <Stickers recipe={recipe} kids={view.children.map((kid) => kid.name)} />
              </span>
              <Tick />
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

/** A round tick, shown on the chosen row; CSS hides it on the others. */
function Tick() {
  return (
    <span className="tick" aria-hidden="true">
      ✓
    </span>
  );
}

function RulesEditor({ view, onChange, onClose }: { view: WeekView; onChange: (change: () => Promise<unknown>) => Promise<void>; onClose: () => void }) {
  const hasKids = useKids();
  const ruleWhats = [...view.categories, "Freezable", "kid-friendly"];
  return (
    <Sheet title={t("Edit rules")} onClose={onClose}>
      <p className="hint">{hasKids ? t("Each rule counts the dinners (or the child's meals) in one week.") : t("Each rule counts the dinners in one week.")}</p>
      <ul className="rule-rows">
        {view.rules.map((rule, index) => (
          <RuleRow key={rule.id} rule={rule} n={index + 1} kids={view.children} options={ruleWhats} onChange={onChange} />
        ))}
      </ul>
      <button type="button" className="btn small sun" onClick={() => onChange(() => addRule({ childId: null, op: "at-least", n: 1, what: "Fish" }))}>
        {t("+ Add a rule")}
      </button>
    </Sheet>
  );
}

function RuleRow({ rule, n, kids, options, onChange }: { rule: WeekRule; n: number; kids: Child[]; options: string[]; onChange: (change: () => Promise<unknown>) => Promise<void> }) {
  // Kept here too, so a second change made before the week reloads doesn't undo the first.
  const [draft, setDraft] = useState<RuleInput>({ childId: rule.childId, op: rule.op, n: rule.n, what: rule.what });
  const save = (patch: Partial<RuleInput>) => {
    const next = { ...draft, ...patch };
    setDraft(next);
    void onChange(() => updateRule(rule.id, next));
  };
  const hasKids = useKids();
  const allowed = hasKids ? options : options.filter((what) => !kidTags.includes(what));
  const whats = allowed.includes(draft.what) ? allowed : [...allowed, draft.what];
  return (
    <li>
      {hasKids && (
        <>
          <select aria-label={`Who ${n}`} value={draft.childId ?? ""} onChange={(event) => save({ childId: event.target.value || null })}>
            <option value="">{t("Adults")}</option>
            {kids.map((kid) => (
              <option key={kid.id} value={kid.id}>
                {kid.name}
              </option>
            ))}
          </select>
          <span>:</span>
        </>
      )}
      <select aria-label={`What ${n}`} value={draft.what} onChange={(event) => save({ what: event.target.value })}>
        {whats.map((what) => (
          <option key={what} value={what}>
            {t(what)}
          </option>
        ))}
      </select>
      <select aria-label={`At least or at most ${n}`} value={draft.op} onChange={(event) => save({ op: event.target.value as RuleOp })}>
        <option value="at-least">{t("at least")}</option>
        <option value="at-most">{t("at most")}</option>
      </select>
      <select aria-label={`How many ${n}`} value={draft.n} onChange={(event) => save({ n: Number(event.target.value) })}>
        {Array.from({ length: 8 }, (_, count) => (
          <option key={count}>{count}</option>
        ))}
      </select>
      <span>{t("a week")}</span>
      <button type="button" className="remove" aria-label={`Remove rule: ${rule.sentence}`} onClick={() => onChange(() => deleteRule(rule.id))}>
        ✕
      </button>
    </li>
  );
}
