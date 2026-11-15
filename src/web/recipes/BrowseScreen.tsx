import { type TouchEvent, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { formatMinutes, type RecipeSummary } from "../../shared/recipes.ts";
import { weekdayName, type WeekView } from "../../shared/week.ts";
import { getWeek, setDinner } from "../week/api.ts";
import { listRecipes, showDate, today } from "./api.ts";
import { chipsFor, daysToPick, filterBook, sameChip, type Chip } from "./book.ts";
import { TypeStickers, typeColour } from "./RecipePage.tsx";
import "./browse.css";

/** Photos this many pages either side of the open one are loaded, so the next page is ready before the swipe. */
const photosAround = 1;

// Kept while the app is open, so coming back from a recipe page opens the book on the same page and filters.
let place: { chosen: Chip[]; at: number } = { chosen: [], at: 0 };

/**
 * The Recipes tab's first screen: the recipe book, one page at a time. Swiping left or right moves through the
 * pages like LP-Collection's record crate; the chips at the top narrow the book to a main type or tag.
 */
export function BrowseScreen() {
  const [recipes, setRecipes] = useState<RecipeSummary[]>();
  const [problem, setProblem] = useState<string>();
  const [chosen, setChosen] = useState(place.chosen);
  const [at, setAt] = useState(place.at);
  const [adding, setAdding] = useState<RecipeSummary>();
  const [added, setAdded] = useState<string>();
  const crate = useRef<HTMLOListElement>(null);
  const restored = useRef(false);

  useEffect(() => {
    listRecipes("").then(setRecipes, (error: Error) => setProblem(error.message));
  }, []);

  const chips = useMemo(() => chipsFor(recipes ?? []), [recipes]);
  const pages = useMemo(() => filterBook(recipes ?? [], chosen), [recipes, chosen]);
  const page = pages[at];
  place = { chosen, at };

  useLayoutEffect(() => {
    const element = crate.current;
    if (!element || restored.current) return;
    restored.current = true;
    if (at >= pages.length) return setAt(0);
    element.scrollTo({ left: at * element.clientWidth, behavior: "instant" });
  }, [pages, at]);

  function onScroll() {
    const element = crate.current;
    if (!element || !restored.current) return;
    const slide = Math.min(Math.round(element.scrollLeft / element.clientWidth), pages.length - 1);
    if (slide !== at) setAt(slide);
  }

  // Past the last page the book starts again at page 1 (and before page 1 comes the last page). The open page
  // tucks itself in at the back of the stack and the other end comes to the front, so it's clear the book went round.
  const [wrapping, setWrapping] = useState<"to-start" | "to-end">();
  const wrapTimers = useRef<number[]>([]);
  useEffect(() => () => wrapTimers.current.forEach((timer) => window.clearTimeout(timer)), []);

  function wrap(direction: "to-start" | "to-end") {
    const element = crate.current;
    if (!element || pages.length < 2) return;
    // A quick second tap doesn't wait for the first animation: it starts its own.
    wrapTimers.current.forEach((timer) => window.clearTimeout(timer));
    wrapTimers.current = [];
    const target = direction === "to-start" ? 0 : pages.length - 1;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setWrapping(direction);
    wrapTimers.current.push(
      window.setTimeout(
        () => {
          element.scrollTo({ left: target * element.clientWidth, behavior: "instant" });
          setAt(target);
        },
        reduced ? 0 : 260,
      ),
      window.setTimeout(() => setWrapping(undefined), reduced ? 1200 : 1400),
    );
  }

  function step(by: number) {
    const element = crate.current;
    if (!element) return;
    if (by > 0 && at >= pages.length - 1) return wrap("to-start");
    if (by < 0 && at === 0) return wrap("to-end");
    element.scrollBy({ left: by * element.clientWidth, behavior: "smooth" });
  }

  // A swipe that can't scroll any further (past the last page, or back from the first) goes round the book too.
  // Where the swipe started counts, not where the scroll got to: a swipe onto the last page isn't one past it.
  const swipeFrom = useRef<{ x: number; y: number; at: number } | undefined>(undefined);
  function onTouchStart(event: TouchEvent) {
    const touch = event.touches[0]!;
    swipeFrom.current = { x: touch.clientX, y: touch.clientY, at };
  }
  function onTouchEnd(event: TouchEvent) {
    const start = swipeFrom.current;
    swipeFrom.current = undefined;
    const touch = event.changedTouches[0];
    if (!start || !touch) return;
    const dx = touch.clientX - start.x;
    if (Math.abs(dx) < 60 || Math.abs(dx) < Math.abs(touch.clientY - start.y)) return;
    if (dx < 0 && start.at >= pages.length - 1) wrap("to-start");
    if (dx > 0 && start.at === 0) wrap("to-end");
  }

  function toggle(chip: Chip) {
    setChosen((current) => (current.some((each) => sameChip(each, chip)) ? current.filter((each) => !sameChip(each, chip)) : [...current, chip]));
    setAt(0);
    crate.current?.scrollTo({ left: 0, behavior: "instant" });
  }

  return (
    <section className="book">
      <div className="book-head">
        <p className="kicker">What's for dinner?</p>
        <div className="book-actions">
          <a className="btn small white" href="#/recipes/list" aria-label="List and search">
            ☰ List
          </a>
          <a className="btn small white" href="#/recipes/freezer">
            ❄ Freezer
          </a>
          <a className="btn small sun" href="#/recipes/new" aria-label="+ Add recipe">
            + Add
          </a>
        </div>
        <h2>
          Flip through <em>the book</em>
        </h2>
      </div>

      {problem && <p role="alert">{problem}</p>}

      {recipes && recipes.length > 0 && (
        <div className="chips" role="group" aria-label="Filter recipes">
          {chips.map((chip) => (
            <button
              key={`${chip.kind}:${chip.value}`}
              type="button"
              className="chip"
              aria-pressed={chosen.some((each) => sameChip(each, chip))}
              onClick={() => toggle(chip)}
            >
              {chip.value === "freezable" ? "❄ freezable" : chip.value}
            </button>
          ))}
        </div>
      )}

      {recipes && recipes.length === 0 && (
        <div className="empty">
          <p className="big">The book is empty.</p>
          <p>Add your first recipe.</p>
        </div>
      )}
      {recipes && recipes.length > 0 && pages.length === 0 && (
        <div className="empty">
          <p className="big">No page matches.</p>
          <p>Tap a chip again to take that filter off.</p>
        </div>
      )}

      {pages.length > 0 && (
        <>
          <div className={`deck${wrapping ? ` wrapping ${wrapping}` : ""}`}>
            {pages.length > 1 && <span className="ghost one" aria-hidden="true" />}
            {pages.length > 2 && <span className="ghost two" aria-hidden="true" />}
            {wrapping && (
              <span className="wrap-note sticker sun" aria-hidden="true">
                {wrapping === "to-start" ? "↺ Back to page 1" : "↻ To the last page"}
              </span>
            )}
            <ol className="crate" ref={crate} onScroll={onScroll} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} aria-label="Recipe pages">
              {pages.map((recipe, index) => (
                <li key={recipe.id} aria-roledescription="page" aria-label={`${recipe.title}, page ${index + 1} of ${pages.length}`} aria-current={index === at ? "true" : undefined}>
                  <BookPage recipe={recipe} number={index + 1} total={pages.length} showPhoto={Math.abs(index - at) <= photosAround} />
                </li>
              ))}
            </ol>
          </div>
          <div className="turn">
            <button type="button" className="round" onClick={() => step(-1)} disabled={pages.length < 2} aria-label={at === 0 ? "Go to the last page" : "Previous page"}>
              ←
            </button>
            {page && (
              <button type="button" className="btn add-week" onClick={() => setAdding(page)}>
                <span aria-hidden="true">📅</span> Add to week
              </button>
            )}
            <button type="button" className="round" onClick={() => step(1)} disabled={pages.length < 2} aria-label={at >= pages.length - 1 ? "Back to page 1" : "Next page"}>
              →
            </button>
          </div>
          <p className="sr" role="status">
            {wrapping === "to-start" && "Back to the start. "}
            {wrapping === "to-end" && "Round to the last page. "}
            {page && `${page.title}, page ${at + 1} of ${pages.length}`}
          </p>
        </>
      )}

      {added && (
        <p className="added" role="status">
          {added}
        </p>
      )}
      {adding && (
        <DayPicker
          recipe={adding}
          onClose={() => setAdding(undefined)}
          onAdded={(message) => {
            setAdding(undefined);
            setAdded(message);
          }}
        />
      )}
    </section>
  );
}

function BookPage({ recipe, number, total, showPhoto }: { recipe: RecipeSummary; number: number; total: number; showPhoto: boolean }) {
  const colour = typeColour[recipe.types[0] ?? ""] ?? "sun";
  return (
    <article className="page">
      <a className={`photo ${colour}`} href={`#/recipes/${recipe.id}`} tabIndex={-1} aria-hidden="true">
        {recipe.mainPhoto && showPhoto ? <img src={recipe.mainPhoto.url} alt="" decoding="async" /> : !recipe.mainPhoto && <Plate />}
        {recipe.tags.includes("freezable") && <span className="stamp">freez-<br />able!</span>}
        <span className="page-no">
          p. {number} / {total}
        </span>
      </a>
      <div className="page-body">
        <h3>
          <a href={`#/recipes/${recipe.id}`}>{recipe.title}</a>
        </h3>
        <p className="meta">
          <span>feeds {recipe.feeds}</span>
          {recipe.minutes !== null && <span>{formatMinutes(recipe.minutes)}</span>}
          <span>{recipe.timesMade ? `Made ${recipe.timesMade}×` : "Not made yet"}</span>
          {recipe.lastMadeOn && <span>last {showDate(recipe.lastMadeOn)}</span>}
        </p>
        <TypeStickers recipe={recipe} />
      </div>
    </article>
  );
}

/** Stands in for a dish photo: a plate with a fork and knife. */
function Plate() {
  return (
    <svg className="plate-art" viewBox="0 0 300 220" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M40 40v40q0 12 10 14v96M30 40v34M50 40v34" />
      <path d="M262 190V60q0-24 12-34v164z" fill="white" />
      <circle cx="152" cy="114" r="88" fill="white" />
      <circle cx="152" cy="114" r="62" strokeWidth="3" strokeDasharray="2 10" />
      <path d="M118 112q34-28 68 0" strokeWidth="4" />
    </svg>
  );
}

type Weeks = { thisWeek: WeekView; nextWeek: WeekView };

function DayPicker({ recipe, onClose, onAdded }: { recipe: RecipeSummary; onClose: () => void; onAdded: (message: string) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [days] = useState(() => daysToPick(today()));
  const [weeks, setWeeks] = useState<Weeks>();
  const [problem, setProblem] = useState<string>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (ref.current && !ref.current.open) ref.current.showModal();
    Promise.all([getWeek(days.thisWeek.monday), getWeek(days.nextWeek.monday)]).then(
      ([thisWeek, nextWeek]) => setWeeks({ thisWeek, nextWeek }),
      (error: Error) => setProblem(error.message),
    );
  }, [days]);

  async function choose(date: string, nextWeek: boolean) {
    setBusy(true);
    setProblem(undefined);
    try {
      await setDinner(date, recipe.id);
      onAdded(`Added to ${weekdayName(date)}${nextWeek ? " next week" : ""}`);
    } catch (error) {
      setProblem((error as Error).message);
      setBusy(false);
    }
  }

  const group = (title: string, dates: string[], view: WeekView | undefined, nextWeek: boolean): ReactNode =>
    dates.length > 0 && (
      <section aria-label={title}>
        <h3>{title}</h3>
        <ul className="day-list">
          {dates.map((date) => {
            const dinner = view?.days.find((day) => day.date === date)?.dinner;
            return (
              <li key={date}>
                <button type="button" disabled={busy || !view} onClick={() => choose(date, nextWeek)}>
                  <b>{weekdayName(date)}</b>
                  <span className="date">{showDate(date).replace(/^\w+ /, "")}</span>
                  <span className={dinner ? "planned" : "free"}>{!view ? "…" : dinner ? dinner.title : "Free"}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    );

  return (
    <dialog ref={ref} className="sheet" aria-label={`Add ${recipe.title} to the week`} onClose={onClose}>
      <div className="sheet-head">
        <h2>Which day?</h2>
        <button type="button" className="btn small white" onClick={onClose}>
          Close
        </button>
      </div>
      <p className="hint">{recipe.title} becomes that day's dinner.</p>
      {problem && <p role="alert">{problem}</p>}
      {group("This week", days.thisWeek.dates, weeks?.thisWeek, false)}
      {group("Next week", days.nextWeek.dates, weeks?.nextWeek, true)}
    </dialog>
  );
}
