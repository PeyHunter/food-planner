import { useEffect, useRef, useState, type FormEvent } from "react";
import { currentLanguage, t } from "../i18n.ts";
import { tagLabel } from "../kids/labels.ts";
import { useKidNames } from "../kitchen.ts";
import { formatMinutes, type Recipe, type RecipeLine, type RecipeSummary } from "../../shared/recipes.ts";
import { isChildRecipe } from "../../shared/week.ts";
import { ageRangeLabel } from "../../shared/child-age.ts";
import { formatAmount, scale } from "../../shared/units.ts";
import { getChildren, addChildFreezerPortion } from "../kids/api.ts";
import type { ChildView } from "../../shared/children.ts";
import { addToFreezer, getRecipe, logCook, showDate, today, uploadPhoto } from "./api.ts";
import { SharePanel } from "./SharePanel.tsx";
import { MakeVegetarian } from "./VegetarianSheet.tsx";
import { PhotoViewer, type ViewerPhoto } from "../PhotoViewer.tsx";

export const typeColour: Record<string, string> = { Fish: "sky", Meat: "tomato", Chicken: "sun", Vegetarian: "mint", Vegetables: "mint" };

export function TypeStickers({ recipe }: { recipe: Pick<RecipeSummary, "types" | "tags"> }) {
  const kidNames = useKidNames();
  return (
    <span className="stickers">
      {recipe.types.map((type, index) => (
        <span key={type} className={`sticker ${typeColour[type] ?? "sun"} ${index % 2 ? "tilt-r" : "tilt-l"}`}>
          {t(type)}
        </span>
      ))}
      {recipe.tags.map((tag) => (
        <span key={tag} className="sticker white">
          {tagLabel(tag, kidNames)}
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

/** Swipe the main photo and the gallery inline; a tap opens the full-screen viewer at that photo. */
function PhotoSwipe({ photos, ageLabel, onOpen }: { photos: ViewerPhoto[]; ageLabel?: string; onOpen: (index: number) => void }) {
  const track = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState(0);
  const many = photos.length > 1;

  const onScroll = () => {
    const element = track.current;
    if (element) setAt(Math.round(element.scrollLeft / element.clientWidth));
  };

  const show = (index: number) => {
    const element = track.current;
    if (element) element.scrollTo({ left: index * element.clientWidth, behavior: "smooth" });
  };

  return (
    <section className="photo-swipe" aria-label={t("Photos")}>
      <div className="photo-swipe-stage">
        <div ref={track} className="photo-swipe-track" onScroll={onScroll}>
          {photos.map((photo, index) => (
            <button key={index} type="button" className="photo-slide" aria-label={t("Open photo {n}", { n: index + 1 })} onClick={() => onOpen(index)}>
              <img src={photo.url} alt={photo.alt} loading={index > 0 ? "lazy" : undefined} />
            </button>
          ))}
        </div>
        {ageLabel && <span className="sticker lilac tilt-r age-sticker">{ageLabel}</span>}
      </div>
      {many && (
        <div className="photo-swipe-foot">
          <span className="photo-swipe-count" aria-live="polite">
            {at + 1} / {photos.length}
          </span>
          <div className="photo-dots">
            {photos.map((_, index) => (
              <button
                key={index}
                type="button"
                className="photo-dot"
                aria-label={t("Photo {n} of {total}", { n: index + 1, total: photos.length })}
                aria-current={index === at ? "true" : undefined}
                onClick={() => show(index)}
              />
            ))}
          </div>
        </div>
      )}
    </section>
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
  const ageLabel = ageRangeLabel(recipe, currentLanguage());

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

      {viewerPhotos.length ? (
        <PhotoSwipe photos={viewerPhotos} ageLabel={ageLabel ?? undefined} onOpen={setViewing} />
      ) : (
        <div className="hero">
          <span className="no-photo" aria-hidden="true" />
          {ageLabel && <span className="sticker lilac tilt-r age-sticker">{ageLabel}</span>}
        </div>
      )}
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
        <FreezerOffer recipeId={id} feeds={recipe.feeds} childRecipe={isChildRecipe(recipe)} onDone={() => setOfferFreezer(false)} />
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

/** After cooking a freezable dish: how many spare portions go in the freezer. A child's recipe goes in her freezer, which child first. */
function FreezerOffer({ recipeId, feeds, childRecipe, onDone }: { recipeId: string; feeds: number; childRecipe: boolean; onDone: () => void }) {
  const [problem, setProblem] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<{ portions: number; child?: ChildView }>();
  const [kids, setKids] = useState<ChildView[]>();
  const [picked, setPicked] = useState<ChildView>();

  useEffect(() => {
    if (!childRecipe) return;
    getChildren().then(setKids, (error: Error) => {
      setProblem(error.message);
      setKids([]);
    });
  }, [childRecipe]);

  // One child in the kitchen is the one; with several, the user picks first.
  const child = childRecipe ? (kids?.length === 1 ? kids[0] : picked) : undefined;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const portions = Number(new FormData(event.currentTarget).get("portions"));
    setBusy(true);
    setProblem(undefined);
    try {
      if (child) await addChildFreezerPortion(child.id, recipeId, portions);
      else await addToFreezer(recipeId, portions);
      setSaved({ portions, child });
    } catch (error) {
      setProblem((error as Error).message);
    }
    setBusy(false);
  };

  if (childRecipe && !kids) return null;

  if (saved)
    return (
      <section className="panel freezer-offer" role="status">
        <p>
          <span className="sticker sky tilt-l">❄ {saved.child ? t("{n} in {name}'s freezer", { n: saved.portions, name: saved.child.name }) : t("{n} in the freezer", { n: saved.portions })}</span>
        </p>
        <div className="pair">
          <a className="ink-button white small" href={saved.child ? "#/kids" : "#/recipes/freezer"}>
            {t("See the freezer")}
          </a>
          <button type="button" className="ink-button small" onClick={onDone}>
            {t("Done")}
          </button>
        </div>
      </section>
    );

  if (childRecipe && kids!.length === 0)
    return (
      <section className="panel freezer-offer">
        <h2>{t("Put portions in the freezer?")}</h2>
        <p className="hint">{t("Add a child first, then the portions can go in their freezer.")}</p>
        <button type="button" className="ink-button white" onClick={onDone}>
          {t("No thanks")}
        </button>
      </section>
    );

  if (childRecipe && !child)
    return (
      <section className="panel freezer-offer" aria-labelledby="freezer-offer-title">
        <h2 id="freezer-offer-title">{t("Whose freezer?")}</h2>
        <div className="chips" role="group" aria-label={t("Whose freezer?")}>
          {kids!.map((kid) => (
            <button key={kid.id} type="button" className="chip" onClick={() => setPicked(kid)}>
              {kid.name}
            </button>
          ))}
        </div>
        <button type="button" className="ink-button white" onClick={onDone}>
          {t("No thanks")}
        </button>
      </section>
    );

  return (
    <form className="panel freezer-offer" aria-labelledby="freezer-offer-title" onSubmit={submit}>
      <h2 id="freezer-offer-title">{child ? t("Put portions in {name}'s freezer?", { name: child.name }) : t("Put portions in the freezer?")}</h2>
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
  const [photoCount, setPhotoCount] = useState(0);

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
      <label className="made-this-photos">
        <span>{t("Photos from this time (if you like)")}</span>
        <span className="ink-button white small file-button">
          {photoCount === 0 ? t("Pick photos") : t(photoCount === 1 ? "1 photo chosen" : "{n} photos chosen", { n: photoCount })}
          <input type="file" name="photos" accept="image/*" multiple onChange={(event) => setPhotoCount(event.target.files?.length ?? 0)} />
        </span>
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
