import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { locale, t } from "../i18n.ts";
import { formatMinutes, type RecipeSummary } from "../../shared/recipes.ts";
import { weekdayName, type WeekView } from "../../shared/week.ts";
import { getWeek, setDinner } from "../week/api.ts";
import { listBookRecipes, showDate, today } from "./api.ts";
import { chipsFor, daysToPick, filterBook, pickFirstPage, sameChip, type Chip } from "./book.ts";
import { TypeStickers, typeColour } from "./RecipePage.tsx";
import { StarterRecipesButton } from "./StarterRecipesButton.tsx";
import "./browse.css";

/** Photos this many pages either side of the open one are loaded, so the next page is ready before the swipe. */
const photosAround = 1;

// Kept while the app is open, so coming back from a recipe page opens the book on the same page and filters.
let place: { chosen: Chip[]; at: number } = { chosen: [], at: 0 };
// Each time the app is opened the book starts on a random page, not the one it started on last time.
let firstPagePicked = false;
const lastFirstKey = "book-last-first";

function rememberedFirst() {
  try {
    return localStorage.getItem(lastFirstKey);
  } catch {
    return null;
  }
}

function rememberFirst(id: string) {
  try {
    localStorage.setItem(lastFirstKey, id);
  } catch {
    // Private mode or storage full: the next open may repeat this page, nothing worse.
  }
}

/**
 * The book view of the Recipes tab: one page at a time. Swiping left or right moves through the
 * pages like LP-Collection's record crate; the chips at the top narrow the book to a main type or tag.
 */
export function BrowseScreen() {
  const [recipes, setRecipes] = useState<RecipeSummary[]>();
  const [problem, setProblem] = useState<string>();
  const [chosen, setChosen] = useState(place.chosen);
  const [at, setAt] = useState(place.at);
  const [adding, setAdding] = useState<RecipeSummary>();
  const crate = useRef<HTMLOListElement>(null);
  const restored = useRef(false);

  const load = () =>
    listBookRecipes("").then(
      (list) => {
        if (!firstPagePicked && list.length > 0) {
          firstPagePicked = true;
          const first = pickFirstPage(list, rememberedFirst());
          rememberFirst(list[first]!.id);
          setAt(first);
        }
        setRecipes(list);
      },
      (error: Error) => setProblem(error.message),
    );
  useEffect(() => {
    void load();
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

  function step(by: number) {
    const element = crate.current;
    element?.scrollBy({ left: by * element.clientWidth, behavior: "smooth" });
  }

  function toggle(chip: Chip) {
    setChosen((current) => (current.some((each) => sameChip(each, chip)) ? current.filter((each) => !sameChip(each, chip)) : [...current, chip]));
    setAt(0);
    crate.current?.scrollTo({ left: 0, behavior: "instant" });
  }

  return (
    <section className="book">
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
              {chip.value === "freezable" ? t("❄ freezable") : t(chip.value)}
            </button>
          ))}
        </div>
      )}

      {recipes && recipes.length === 0 && (
        <div className="empty">
          <p className="big">{t("The book is empty.")}</p>
          <p>{t("Add your first recipe.")}</p>
          <StarterRecipesButton onAdded={load} />
        </div>
      )}
      {recipes && recipes.length > 0 && pages.length === 0 && (
        <div className="empty">
          <p className="big">{t("No page matches.")}</p>
          <p>{t("Tap a chip again to take that filter off.")}</p>
        </div>
      )}

      {pages.length > 0 && (
        <>
          <div className="deck">
            {pages.length > 1 && <span className="ghost one" aria-hidden="true" />}
            {pages.length > 2 && <span className="ghost two" aria-hidden="true" />}
            <ol className="crate" ref={crate} onScroll={onScroll} aria-label="Recipe pages">
              {pages.map((recipe, index) => (
                <li key={recipe.id} aria-roledescription="page" aria-label={`${recipe.title}, page ${index + 1} of ${pages.length}`} aria-current={index === at ? "true" : undefined}>
                  <BookPage recipe={recipe} number={index + 1} total={pages.length} showPhoto={Math.abs(index - at) <= photosAround} />
                </li>
              ))}
            </ol>
          </div>
          <div className="turn">
            <button type="button" className="round" onClick={() => step(-1)} disabled={at === 0} aria-label="Previous page">
              ←
            </button>
            {page && (
              <button type="button" className="btn add-week" onClick={() => setAdding(page)}>
                <span aria-hidden="true">📅</span> {t("Add to week")}
              </button>
            )}
            <button type="button" className="round" onClick={() => step(1)} disabled={at >= pages.length - 1} aria-label="Next page">
              →
            </button>
          </div>
          <p className="sr" role="status">
            {page && `${page.title}, page ${at + 1} of ${pages.length}`}
          </p>
        </>
      )}

      {adding && <DayPicker recipe={adding} onClose={() => setAdding(undefined)} />}
    </section>
  );
}

function BookPage({ recipe, number, total, showPhoto }: { recipe: RecipeSummary; number: number; total: number; showPhoto: boolean }) {
  const colour = typeColour[recipe.types[0] ?? ""] ?? "sun";
  return (
    <article className="page">
      <a className={`photo ${colour}`} href={`#/recipes/${recipe.id}`} tabIndex={-1} aria-hidden="true">
        {recipe.mainPhoto && showPhoto ? <img src={recipe.mainPhoto.url} alt="" decoding="async" /> : !recipe.mainPhoto && <Plate />}
        {recipe.tags.includes("freezable") && <span className="stamp">{t("freez-\nable!")}</span>}
        <span className="page-no">{t("p. {n} / {total}", { n: number, total })}</span>
      </a>
      <div className="page-body">
        <h3>
          <a href={`#/recipes/${recipe.id}`}>{recipe.title}</a>
        </h3>
        <p className="meta">
          <span>{t("feeds {n}", { n: recipe.feeds })}</span>
          {recipe.minutes !== null && <span>{formatMinutes(recipe.minutes)}</span>}
          <span>{recipe.timesMade ? t("Made {n}×", { n: recipe.timesMade }) : t("Not made yet")}</span>
          {recipe.lastMadeOn && <span>{t("last {date}", { date: showDate(recipe.lastMadeOn) })}</span>}
        </p>
        <TypeStickers recipe={recipe} />
      </div>
    </article>
  );
}

/** Stands in for a dish photo: a plate with a fork and knife. */
export function Plate() {
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

function DayPicker({ recipe, onClose }: { recipe: RecipeSummary; onClose: () => void }) {
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

  async function choose(date: string) {
    setBusy(true);
    setProblem(undefined);
    try {
      await setDinner(date, recipe.id);
      onClose();
    } catch (error) {
      setProblem((error as Error).message);
      setBusy(false);
    }
  }

  const group = (title: string, dates: string[], view: WeekView | undefined): ReactNode =>
    dates.length > 0 && (
      <section aria-label={title}>
        <h3>{title}</h3>
        <ul className="day-list">
          {dates.map((date) => {
            const dinner = view?.days.find((day) => day.date === date)?.dinner;
            return (
              <li key={date}>
                <button type="button" disabled={busy || !view} onClick={() => choose(date)}>
                  <span className="when">
                    <b>{weekdayName(date, locale())}</b>
                    <span className="date">{showDate(date).replace(/^\S+ /, "")}</span>
                  </span>
                  {dinner ? (
                    <span className="planned">
                      <span className="now">{t("Now:")}</span> {dinner.title}
                    </span>
                  ) : (
                    <span className="free">{!view ? "…" : t("Free")}</span>
                  )}
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
        <h2>{t("Which day?")}</h2>
        <button type="button" className="btn small white" onClick={onClose}>
          {t("Close")}
        </button>
      </div>
      <p className="hint">{t("{title} becomes that day's dinner.", { title: recipe.title })}</p>
      {problem && <p role="alert">{problem}</p>}
      {group(t("This week"), days.thisWeek.dates, weeks?.thisWeek)}
      {group(t("Next week"), days.nextWeek.dates, weeks?.nextWeek)}
    </dialog>
  );
}
