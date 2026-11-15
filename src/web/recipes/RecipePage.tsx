import { useEffect, useState, type FormEvent } from "react";
import type { Recipe, RecipeLine, RecipeSummary } from "../../shared/recipes.ts";
import { ageRangeLabel } from "../../shared/child-age.ts";
import { formatAmount, scale } from "../../shared/units.ts";
import { getRecipe, logCook, showDate, today, uploadPhoto } from "./api.ts";
import { SharePanel } from "./SharePanel.tsx";

export const typeColour: Record<string, string> = { Fish: "sky", Meat: "tomato", Chicken: "sun", Vegetarian: "mint", Vegetables: "mint" };

export function TypeStickers({ recipe }: { recipe: Pick<RecipeSummary, "types" | "tags"> }) {
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

function lineAmount(line: RecipeLine, from: number, to: number) {
  if (line.amount === null || line.unit === null) return "";
  return `${formatAmount(scale(line.amount, line.unit, from, to))} ${line.unit}`;
}

/** Ingredients with the − N + stepper that scales the amounts. Used on the recipe page and the public share page. */
export function IngredientsPanel({ recipe }: { recipe: Pick<Recipe, "feeds" | "lines"> }) {
  const [people, setPeople] = useState(recipe.feeds);
  return (
    <section className="panel">
      <div className="bar">
        <h2>Ingredients</h2>
        <div className="stepper" role="group" aria-label="How many people">
          <button type="button" aria-label="Fewer people" disabled={people <= 1} onClick={() => setPeople(people - 1)}>
            −
          </button>
          <output aria-live="polite">Feeds {people}</output>
          <button type="button" aria-label="More people" disabled={people >= 100} onClick={() => setPeople(people + 1)}>
            +
          </button>
        </div>
      </div>
      {people !== recipe.feeds && <p className="hint">Amounts scaled from {recipe.feeds} people and rounded up.</p>}
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
      <h2>Steps</h2>
      <ol className="steps">
        {steps.map((step, index) => (
          <li key={index}>{step}</li>
        ))}
      </ol>
    </section>
  );
}

export function RecipePage({ id }: { id: string }) {
  const [recipe, setRecipe] = useState<Recipe>();
  const [problem, setProblem] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [logging, setLogging] = useState(false);

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
        <a className="back" href="#/recipes" aria-label="Back to recipes">
          ←
        </a>
        <a className="ink-button white small" href={`#/recipes/${id}/edit`}>
          Edit
        </a>
      </nav>

      <div className="hero">
        {recipe.mainPhoto ? <img src={recipe.mainPhoto.url} alt={recipe.title} /> : <span className="no-photo" aria-hidden="true" />}
        <TypeStickers recipe={recipe} />
        {ageRangeLabel(recipe) && <span className="sticker lilac tilt-r age-sticker">{ageRangeLabel(recipe)}</span>}
      </div>
      <h1>{recipe.title}</h1>
      {recipe.lastMadeOn && (
        <p className="made">
          Made {recipe.cooks.length === 1 ? "once" : `${recipe.cooks.length} times`}, last on {showDate(recipe.lastMadeOn)}
        </p>
      )}

      <IngredientsPanel recipe={recipe} />
      <StepsPanel steps={recipe.steps} />
      <SharePanel key={id} recipeId={id} title={recipe.title} shareUrl={recipe.shareUrl} />

      <section className="panel">
        <div className="bar">
          <h2>Photos</h2>
          <label className="ink-button white small file-button">
            Add photos
            <input type="file" accept="image/*" multiple disabled={busy} onChange={(event) => void addPhotos(event.target.files)} />
          </label>
        </div>
        {gallery.length ? (
          <ul className="gallery">
            {gallery.map((photo) => (
              <li key={photo.id}>
                <a href={photo.url} target="_blank" rel="noreferrer">
                  <img src={photo.url} alt="Recipe photo" loading="lazy" />
                </a>
              </li>
            ))}
          </ul>
        ) : (
          <p className="hint">No extra photos yet.</p>
        )}
      </section>

      {problem && <p role="alert">{problem}</p>}

      {logging ? (
        <MadeThisForm
          recipeId={id}
          onDone={async () => {
            setLogging(false);
            await load();
          }}
          onCancel={() => setLogging(false)}
        />
      ) : (
        <button type="button" className="ink-button big" onClick={() => setLogging(true)}>
          I made this
        </button>
      )}

      {recipe.cooks.length > 0 && (
        <section className="panel">
          <h2>Cooked</h2>
          <ul className="cooks">
            {recipe.cooks.map((cook) => (
              <li key={cook.id}>
                {showDate(cook.madeOn)}
                {cook.by && ` by ${cook.by.charAt(0).toUpperCase()}${cook.by.slice(1)}`}
                {cook.photos.length > 0 && ` (${cook.photos.length} ${cook.photos.length === 1 ? "photo" : "photos"})`}
              </li>
            ))}
          </ul>
        </section>
      )}
    </article>
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
      <h2>I made this</h2>
      <label>
        When
        <input type="date" name="madeOn" defaultValue={today()} max={today()} required />
      </label>
      <label>
        Photos from this time (if you like)
        <input type="file" name="photos" accept="image/*" multiple />
      </label>
      {problem && <p role="alert">{problem}</p>}
      <div className="bar">
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
