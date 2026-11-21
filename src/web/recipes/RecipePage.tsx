import { useEffect, useState, type FormEvent } from "react";
import { currentLanguage, t } from "../i18n.ts";
import { formatMinutes, type Recipe, type RecipeLine, type RecipeSummary } from "../../shared/recipes.ts";
import { ageRangeLabel } from "../../shared/child-age.ts";
import { formatAmount, scale } from "../../shared/units.ts";
import { addToFreezer, getRecipe, logCook, showDate, today, uploadPhoto } from "./api.ts";
import { SharePanel } from "./SharePanel.tsx";
import { MakeVegetarian } from "./VegetarianSheet.tsx";
import { PhotoViewer, type ViewerPhoto } from "../PhotoViewer.tsx";

export const typeColour: Record<string, string> = { Fish: "sky", Meat: "tomato", Chicken: "sun", Vegetarian: "mint", Vegetables: "mint" };

export function TypeStickers({ recipe }: { recipe: Pick<RecipeSummary, "types" | "tags"> }) {
  return (
    <span className="stickers">
      {recipe.types.map((type, index) => (
        <span key={type} className={`sticker ${typeColour[type] ?? "sun"} ${index % 2 ? "tilt-r" : "tilt-l"}`}>
          {t(type)}
        </span>
      ))}
      {recipe.tags.map((tag) => (
        <span key={tag} className="sticker white">
          {t(tag)}
        </span>
      ))}
    </span>
  );
}

function lineAmount(line: RecipeLine, from: number, to: number) {
  if (line.amount === null || line.unit === null) return "";
  return `${formatAmount(scale(line.amount, line.unit, from, to), line.unit)} ${t(line.unit)}`;
}

/** Ingredients with the − N + stepper that scales the amounts. Used on the recipe page and the public share page. */
export function IngredientsPanel({ recipe }: { recipe: Pick<Recipe, "feeds" | "lines"> }) {
  const [people, setPeople] = useState(recipe.feeds);
  return (
    <section className="panel">
      <div className="bar">
        <h2>{t("Ingredients")}</h2>
        <div className="stepper" role="group" aria-label={t("How many people")}>
          <button type="button" aria-label={t("Fewer people")} disabled={people <= 1} onClick={() => setPeople(people - 1)}>
            −
          </button>
          <output aria-live="polite">{t("Feeds {n}", { n: people })}</output>
          <button type="button" aria-label={t("More people")} disabled={people >= 100} onClick={() => setPeople(people + 1)}>
            +
          </button>
        </div>
      </div>
      {people !== recipe.feeds && <p className="hint">{t("Amounts scaled from {n} people and rounded up.", { n: recipe.feeds })}</p>}
      <ul className="lines">
        {recipe.lines.map((line, index) => (
          <li key={index}>
            <span className="amount">{lineAmount(line, recipe.feeds, people)}</span>
            <span>
              {line.ingredient.name}
              {line.note && <span className="note">, {line.note}</span>}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function StepsPanel({ steps }: { steps: string[] }) {
  if (!steps.length) return null;
  return (
    <section className="panel">
      <h2>{t("Steps")}</h2>
      <ol className="steps">
        {steps.map((step, index) => (
          <li key={index}>{step}</li>
        ))}
      </ol>
    </section>
  );
}

/** The main photo first, then the gallery, as the full-screen viewer shows them. */
export function photosToView(title: string, main: { url: string } | null, gallery: { url: string }[]): ViewerPhoto[] {
  return [...(main ? [{ url: main.url, alt: title }] : []), ...gallery.map((photo, index) => ({ url: photo.url, alt: t("Photo {n} of {total}", { n: index + 1, total: gallery.length }) }))];
}

/** Gallery thumbnails; a tap opens that photo full-screen. Used on the recipe page and the share page. */
export function Gallery({ photos, onOpen }: { photos: { id: string; url: string }[]; onOpen: (index: number) => void }) {
  return (
    <ul className="gallery">
      {photos.map((photo, index) => (
        <li key={photo.id}>
          <img src={photo.url} alt={t("Recipe photo")} loading="lazy" />
          <button type="button" className="open-photo" aria-label={t("Open photo {n}", { n: index + 1 })} onClick={() => onOpen(index)} />
        </li>
      ))}
    </ul>
  );
}

/** week: the Monday of the week plan this was opened from, so the back arrow returns there. */
export function RecipePage({ id, week = null }: { id: string; week?: string | null }) {
  const [recipe, setRecipe] = useState<Recipe>();
  const [problem, setProblem] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [logging, setLogging] = useState(false);
  const [offerFreezer, setOfferFreezer] = useState(false);
  const [viewing, setViewing] = useState<number>();

  const load = () =>
    getRecipe(id).then(
      (loaded) => setRecipe(loaded),
      (error: Error) => setProblem(error.message),
    );

  useEffect(() => {
    void load();
  }, [id]);

  if (!recipe) return problem ? <p role="alert">{problem}</p> : null;

  const gallery = recipe.photos.filter((photo) => photo.role === "gallery");
  const viewerPhotos = photosToView(recipe.title, recipe.mainPhoto, gallery);
  const galleryStart = recipe.mainPhoto ? 1 : 0;

  const addPhotos = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    setProblem(undefined);
    try {
      for (const file of files) await uploadPhoto(id, file, "gallery");
    } catch (error) {
      setProblem((error as Error).message);
    }
    await load();
    setBusy(false);
  };

  return (
    <article className="recipe-page">
      <nav className="bar">
        <a className="back" href={week ? `#/week?monday=${week}` : "#/recipes"} aria-label={week ? t("Back to the week") : t("Back to recipes")}>
          ←
        </a>
        <a className="ink-button white small" href={`#/recipes/${id}/edit`}>
          {t("Edit")}
        </a>
        <MakeVegetarian recipe={recipe} />
      </nav>

      <div className="hero">
        {recipe.mainPhoto ? <img src={recipe.mainPhoto.url} alt={recipe.title} /> : <span className="no-photo" aria-hidden="true" />}
        {recipe.mainPhoto && <button type="button" className="hero-open" aria-label={t("Open the photo")} onClick={() => setViewing(0)} />}
        {ageRangeLabel(recipe, currentLanguage()) && <span className="sticker lilac tilt-r age-sticker">{ageRangeLabel(recipe, currentLanguage())}</span>}
      </div>
      <h1>{recipe.title}</h1>
      <TypeStickers recipe={recipe} />
      {recipe.minutes !== null && <p className="time">{t("Takes {time}", { time: formatMinutes(recipe.minutes) })}</p>}
      {recipe.description && <p className="description">{recipe.description}</p>}
      {recipe.lastMadeOn && (
        <p className="made">
          {t(recipe.cooks.length === 1 ? "Made once, last on {date}" : "Made {n} times, last on {date}", { n: recipe.cooks.length, date: showDate(recipe.lastMadeOn) })}
        </p>
      )}

      <IngredientsPanel recipe={recipe} />
      <StepsPanel steps={recipe.steps} />
      <SharePanel key={id} recipe={recipe} />

      <section className="panel">
        <div className="bar">
          <h2>{t("Photos")}</h2>
          <label className="ink-button white small file-button">
            {t("Add photos")}
            <input type="file" accept="image/*" multiple disabled={busy} onChange={(event) => void addPhotos(event.target.files)} />
          </label>
        </div>
        {gallery.length ? (
          <Gallery photos={gallery} onOpen={(index) => setViewing(galleryStart + index)} />
        ) : (
          <p className="hint">{t("No extra photos yet.")}</p>
        )}
      </section>

      {problem && <p role="alert">{problem}</p>}
      {viewing !== undefined && <PhotoViewer photos={viewerPhotos} start={viewing} onClose={() => setViewing(undefined)} />}

      {logging ? (
        <MadeThisForm
          recipeId={id}
          onDone={async () => {
            setLogging(false);
            setOfferFreezer(recipe.tags.includes("freezable"));
            await load();
          }}
          onCancel={() => setLogging(false)}
        />
      ) : offerFreezer ? (
        <FreezerOffer recipeId={id} feeds={recipe.feeds} onDone={() => setOfferFreezer(false)} />
      ) : (
        <button type="button" className="ink-button big" onClick={() => setLogging(true)}>
          {t("I made this")}
        </button>
      )}

      {recipe.cooks.length > 0 && (
        <section className="panel">
          <h2>{t("Cooked")}</h2>
          <ul className="cooks">
            {recipe.cooks.map((cook) => (
              <li key={cook.id}>
                {showDate(cook.madeOn)}
                {cook.by && ` ${t("by {name}", { name: `${cook.by.charAt(0).toUpperCase()}${cook.by.slice(1)}` })}`}
                {cook.photos.length > 0 && ` (${t(cook.photos.length === 1 ? "1 photo" : "{n} photos", { n: cook.photos.length })})`}
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
  );
}

/** After cooking a freezable dish: how many spare portions go in the freezer. */
function FreezerOffer({ recipeId, feeds, onDone }: { recipeId: string; feeds: number; onDone: () => void }) {
  const [problem, setProblem] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<number>();

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const portions = Number(new FormData(event.currentTarget).get("portions"));
    setBusy(true);
    setProblem(undefined);
    try {
      await addToFreezer(recipeId, portions);
      setSaved(portions);
    } catch (error) {
      setProblem((error as Error).message);
    }
    setBusy(false);
  };

  if (saved !== undefined)
    return (
      <section className="panel freezer-offer" role="status">
        <p>
          <span className="sticker sky tilt-l">❄ {t("{n} in the freezer", { n: saved })}</span>
        </p>
        <div className="pair">
          <a className="ink-button white small" href="#/recipes/freezer">
            {t("See the freezer")}
          </a>
          <button type="button" className="ink-button small" onClick={onDone}>
            {t("Done")}
          </button>
        </div>
      </section>
    );

  return (
    <form className="panel freezer-offer" aria-labelledby="freezer-offer-title" onSubmit={submit}>
      <h2 id="freezer-offer-title">{t("Put portions in the freezer?")}</h2>
      <label>
        {t("Portions")}
        <input type="number" name="portions" min={1} max={50} step={1} defaultValue={feeds} required />
      </label>
      {problem && <p role="alert">{problem}</p>}
      <div className="pair">
        <button type="button" className="ink-button white" onClick={onDone}>
          {t("No thanks")}
        </button>
        <button type="submit" className="ink-button" disabled={busy}>
          {t("❄ Put in the freezer")}
        </button>
      </div>
    </form>
  );
}

function MadeThisForm({ recipeId, onDone, onCancel }: { recipeId: string; onDone: () => Promise<void>; onCancel: () => void }) {
  const [problem, setProblem] = useState<string>();
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const files = form.getAll("photos").filter((value): value is File => value instanceof File && value.size > 0);
    setBusy(true);
    setProblem(undefined);
    try {
      await logCook(recipeId, String(form.get("madeOn") || today()), files);
      await onDone();
    } catch (error) {
      setProblem((error as Error).message);
      setBusy(false);
    }
  };

  return (
    <form className="panel made-this" onSubmit={submit}>
      <h2>{t("I made this")}</h2>
      <label>
        {t("When")}
        <input type="date" name="madeOn" defaultValue={today()} max={today()} required />
      </label>
      <label>
        {t("Photos from this time (if you like)")}
        <input type="file" name="photos" accept="image/*" multiple />
      </label>
      {problem && <p role="alert">{problem}</p>}
      <div className="bar">
        <button type="button" className="ink-button white" onClick={onCancel}>
          {t("Cancel")}
        </button>
        <button type="submit" className="ink-button" disabled={busy}>
          {busy ? t("Saving…") : t("Save")}
        </button>
      </div>
    </form>
  );
}
