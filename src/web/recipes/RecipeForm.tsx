import { useEffect, useState, type FormEvent } from "react";
import { builtInTags, mainTypes, type IngredientSuggestion, type MainType, type PhotoRecipeDraft, type RecipeInput } from "../../shared/recipes.ts";
import { isUnit, units } from "../../shared/units.ts";
import { createRecipe, deleteRecipe, getRecipe, go, suggestIngredients, updateRecipe, uploadPhoto } from "./api.ts";

// Form fields hold text while typing; they become numbers on save.
type LineDraft = { amount: string; unit: string; ingredient: string; note: string };
type Draft = {
  title: string;
  description: string;
  feeds: string;
  types: MainType[];
  tags: string[];
  otherTags: string;
  ageFrom: string;
  ageTo: string;
  lines: LineDraft[];
  steps: string[];
};

const emptyLine = (): LineDraft => ({ amount: "", unit: "g", ingredient: "", note: "" });
const blank: Draft = { title: "", description: "", feeds: "4", types: [], tags: [], otherTags: "", ageFrom: "", ageTo: "", lines: [emptyLine()], steps: [""] };

const toggle = <T,>(list: T[], item: T) => (list.includes(item) ? list.filter((value) => value !== item) : [...list, item]);
const numberOrNull = (text: string) => (text.trim() === "" ? null : Number(text.replace(",", ".")));

function toInput(draft: Draft): RecipeInput {
  const otherTags = draft.otherTags
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
  return {
    title: draft.title,
    description: draft.description,
    feeds: Number(draft.feeds),
    types: draft.types,
    tags: [...new Set([...draft.tags, ...otherTags])],
    ageFromMonths: numberOrNull(draft.ageFrom),
    ageToMonths: numberOrNull(draft.ageTo),
    lines: draft.lines
      .filter((line) => line.ingredient.trim() || line.amount.trim())
      .map((line) => {
        const amount = numberOrNull(line.amount);
        if (Number.isNaN(amount)) throw new Error(`The amount for ${line.ingredient || "an ingredient"} must be a number, like 2 or 0.5.`);
        return { amount, unit: amount === null || !isUnit(line.unit) ? null : line.unit, ingredient: line.ingredient, note: line.note };
      }),
    steps: draft.steps,
  };
}

/** What a new recipe starts with, e.g. from "+ New recipe for Runi". */
export type Prefill = { tags: string[]; ageFrom: string };

function startDraft({ tags, ageFrom }: Prefill): Draft {
  const isBuiltIn = (tag: string) => (builtInTags as readonly string[]).includes(tag);
  return { ...blank, tags: tags.filter(isBuiltIn), otherTags: tags.filter((tag) => !isBuiltIn(tag)).join(", "), ageFrom };
}

/** A recipe read from photos, to check before saving. The photos can be kept in the gallery. */
export type FromPhoto = PhotoRecipeDraft & { photos: File[] };

function dataUrlToFile(dataUrl: string, name: string) {
  const [head = "", base64 = ""] = dataUrl.split(",");
  const type = /^data:([^;]+)/.exec(head)?.[1] ?? "image/jpeg";
  return new File([Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))], name, { type });
}

/** The main photo a scanned recipe starts with: the dish picture cut out of the book, or else the first page. */
function startPhoto(fromPhoto?: FromPhoto): { file: File; from: "dish" | "page" } | undefined {
  if (!fromPhoto) return undefined;
  if (fromPhoto.dishPhoto) return { file: dataUrlToFile(fromPhoto.dishPhoto, "dish.jpg"), from: "dish" };
  const page = fromPhoto.photos[0];
  return page && { file: page, from: "page" };
}

function photoDraft({ recipe }: FromPhoto): Draft {
  const isBuiltIn = (tag: string) => (builtInTags as readonly string[]).includes(tag);
  return {
    ...blank,
    title: recipe.title,
    description: recipe.description ?? "",
    feeds: String(recipe.feeds),
    types: recipe.types,
    tags: recipe.tags.filter(isBuiltIn),
    otherTags: recipe.tags.filter((tag) => !isBuiltIn(tag)).join(", "),
    lines: [...recipe.lines.map((line) => ({ amount: line.amount === null ? "" : String(line.amount), unit: line.unit ?? "", ingredient: line.ingredient, note: line.note })), emptyLine()],
    steps: [...recipe.steps, ""],
  };
}

export function RecipeForm({ id, start, fromPhoto }: { id?: string; start?: Prefill; fromPhoto?: FromPhoto }) {
  const [draft, setDraft] = useState<Draft | undefined>(id ? undefined : fromPhoto ? photoDraft(fromPhoto) : start ? startDraft(start) : blank);
  const [keepPhotos, setKeepPhotos] = useState(true);
  const [started] = useState(() => startPhoto(fromPhoto));
  const [photo, setPhoto] = useState<File | undefined>(started?.file);
  const [preview, setPreview] = useState<string>();
  const [problem, setProblem] = useState<string>();
  // What the save button says while it works, e.g. "Uploading photo… 60%".
  const [busy, setBusy] = useState<string>();

  useEffect(() => {
    if (!id) return;
    getRecipe(id).then(
      (recipe) =>
        setDraft({
          title: recipe.title,
          description: recipe.description,
          feeds: String(recipe.feeds),
          types: recipe.types,
          tags: recipe.tags.filter((tag) => (builtInTags as readonly string[]).includes(tag)),
          otherTags: recipe.tags.filter((tag) => !(builtInTags as readonly string[]).includes(tag)).join(", "),
          ageFrom: recipe.ageFromMonths === null ? "" : String(recipe.ageFromMonths),
          ageTo: recipe.ageToMonths === null ? "" : String(recipe.ageToMonths),
          lines: [
            ...recipe.lines.map((line) => ({ amount: line.amount === null ? "" : String(line.amount), unit: line.unit ?? "", ingredient: line.ingredient.name, note: line.note })),
            emptyLine(),
          ],
          steps: [...recipe.steps, ""],
        }),
      (error: Error) => setProblem(error.message),
    );
  }, [id]);

  useEffect(() => {
    if (!photo) return;
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  if (!draft) return problem ? <p role="alert">{problem}</p> : null;

  const set = (change: Partial<Draft>) => setDraft({ ...draft, ...change });
  const setLine = (index: number, change: Partial<LineDraft>) => set({ lines: draft.lines.map((line, at) => (at === index ? { ...line, ...change } : line)) });
  const setStep = (index: number, text: string) => set({ steps: draft.steps.map((step, at) => (at === index ? text : step)) });

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setBusy("Saving…");
    setProblem(undefined);
    try {
      const input = toInput(draft);
      const saved = id ? await updateRecipe(id, input) : await createRecipe(input);
      if (photo) {
        setBusy("Uploading photo… 0%");
        // Once all of it is sent, the server still has to shrink it.
        await uploadPhoto(saved.id, photo, "main", (sent) => setBusy(sent < 1 ? `Uploading photo… ${Math.round(sent * 100)}%` : "Saving…"));
      }
      if (fromPhoto && keepPhotos) {
        setBusy("Saving the recipe photo…");
        // The first page is already the main photo when the book had no dish picture.
        for (const page of fromPhoto.photos) if (page !== photo) await uploadPhoto(saved.id, page, "gallery");
      }
      go(`/recipes/${saved.id}`);
    } catch (error) {
      setProblem((error as Error).message);
      setBusy(undefined);
    }
  };

  const remove = async () => {
    if (!id || !window.confirm(`Delete "${draft.title}"? This can't be undone.`)) return;
    try {
      await deleteRecipe(id);
      go("/recipes");
    } catch (error) {
      setProblem((error as Error).message);
    }
  };

  return (
    <form className="recipe-form" onSubmit={save}>
      <nav className="bar">
        <a className="back" href={id ? `#/recipes/${id}` : "#/recipes"} aria-label="Back">
          ←
        </a>
        <h2>{id ? "Edit recipe" : fromPhoto ? "Check the recipe" : "New recipe"}</h2>
      </nav>
      {!id && !fromPhoto && (
        <a className="ink-button white small" href="#/recipes/from-photo">
          Photo to recipe
        </a>
      )}
      {fromPhoto && (
        <div className="hint">
          <p>Read from your photo. Check it, fix anything that's wrong, then save.</p>
          {fromPhoto.notes.length > 0 && (
            <ul aria-label="Notes from reading">
              {fromPhoto.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <label>
        Name
        <input value={draft.title} onChange={(event) => set({ title: event.target.value })} required maxLength={200} />
      </label>
      <label>
        Description
        <textarea rows={3} value={draft.description} onChange={(event) => set({ description: event.target.value })} maxLength={2000} placeholder="A few words about the dish" />
      </label>
      <label className="narrow">
        Feeds (people)
        <input type="number" inputMode="numeric" min={1} max={100} value={draft.feeds} onChange={(event) => set({ feeds: event.target.value })} required />
      </label>

      <fieldset>
        <legend>Main type</legend>
        <div className="chips">
          {mainTypes.map((type) => (
            <button key={type} type="button" className="chip" aria-pressed={draft.types.includes(type)} onClick={() => set({ types: toggle(draft.types, type) })}>
              {type}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend>Tags</legend>
        <div className="chips">
          {builtInTags.map((tag) => (
            <button key={tag} type="button" className="chip" aria-pressed={draft.tags.includes(tag)} onClick={() => set({ tags: toggle(draft.tags, tag) })}>
              {tag}
            </button>
          ))}
        </div>
        <label>
          Other tags (put a comma between them)
          <input value={draft.otherTags} onChange={(event) => set({ otherTags: event.target.value })} placeholder="quick, summer" />
        </label>
      </fieldset>

      <fieldset>
        <legend>For babies and kids (leave empty if not)</legend>
        <div className="row">
          <label>
            Suits babies from (months)
            <input type="number" inputMode="numeric" min={0} max={240} value={draft.ageFrom} onChange={(event) => set({ ageFrom: event.target.value })} />
          </label>
          <label>
            to (months)
            <input type="number" inputMode="numeric" min={0} max={240} value={draft.ageTo} onChange={(event) => set({ ageTo: event.target.value })} />
          </label>
        </div>
      </fieldset>

      <fieldset>
        <legend>Ingredients</legend>
        <ol className="line-rows">
          {draft.lines.map((line, index) => (
            <IngredientRow key={index} index={index} line={line} onChange={(change) => setLine(index, change)} onRemove={() => set({ lines: draft.lines.filter((_, at) => at !== index) })} />
          ))}
        </ol>
        <button type="button" className="ink-button white small" onClick={() => set({ lines: [...draft.lines, emptyLine()] })}>
          + Add ingredient
        </button>
      </fieldset>

      <fieldset>
        <legend>Steps</legend>
        <ol className="step-rows">
          {draft.steps.map((step, index) => (
            <li key={index}>
              <textarea aria-label={`Step ${index + 1}`} rows={2} value={step} onChange={(event) => setStep(index, event.target.value)} />
            </li>
          ))}
        </ol>
        <button type="button" className="ink-button white small" onClick={() => set({ steps: [...draft.steps, ""] })}>
          + Add step
        </button>
      </fieldset>

      <fieldset>
        <legend>Main photo</legend>
        {preview && <img className="preview" src={preview} alt="New main photo" />}
        {started && photo === started.file && (
          <p className="hint">{started.from === "dish" ? "The dish picture from the book. Pick another photo if it isn't right." : "No dish picture found, so the recipe photo is used. Pick another photo if you have one."}</p>
        )}
        <label className="ink-button white small file-button">
          {photo ? "Pick another photo" : id ? "Change main photo" : "Pick a photo"}
          <input type="file" accept="image/*" aria-label="Main photo" onChange={(event) => setPhoto(event.target.files?.[0])} />
        </label>
      </fieldset>

      {fromPhoto && (
        <label className="check">
          <input type="checkbox" checked={keepPhotos} onChange={(event) => setKeepPhotos(event.target.checked)} />
          Keep the recipe pages as gallery photos
        </label>
      )}

      {problem && <p role="alert">{problem}</p>}
      <button type="submit" className="ink-button big" disabled={busy !== undefined}>
        {busy ?? "Save recipe"}
      </button>
      {id && (
        <button type="button" className="quiet danger" onClick={remove}>
          Delete recipe
        </button>
      )}
    </form>
  );
}

function IngredientRow({ index, line, onChange, onRemove }: { index: number; line: LineDraft; onChange: (change: Partial<LineDraft>) => void; onRemove: () => void }) {
  const [suggestions, setSuggestions] = useState<IngredientSuggestion[]>([]);
  const [focused, setFocused] = useState(false);
  const n = index + 1;

  useEffect(() => {
    const q = line.ingredient.trim();
    if (!focused || !q) return setSuggestions([]);
    let current = true;
    const timer = setTimeout(() => {
      suggestIngredients(q).then(
        (found) => current && setSuggestions(found.filter((item) => item.name.toLowerCase() !== q.toLowerCase())),
        () => {},
      );
    }, 120);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [line.ingredient, focused]);

  return (
    <li className="line-row">
      <input className="amount" aria-label={`Amount ${n}`} inputMode="decimal" placeholder="2" value={line.amount} onChange={(event) => onChange({ amount: event.target.value })} />
      <select aria-label={`Unit ${n}`} value={line.unit} onChange={(event) => onChange({ unit: event.target.value })}>
        <option value="">—</option>
        {units.map((unit) => (
          <option key={unit}>{unit}</option>
        ))}
      </select>
      <div className="suggest-wrap">
        <input
          aria-label={`Ingredient ${n}`}
          placeholder="carrot"
          autoComplete="off"
          value={line.ingredient}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onChange={(event) => onChange({ ingredient: event.target.value })}
        />
        {suggestions.length > 0 && (
          <ul className="suggest" aria-label={`Suggestions for ingredient ${n}`}>
            {suggestions.map((item) => (
              <li key={item.id}>
                {/* mousedown would blur the field and hide the list before the tap lands */}
                <button type="button" onMouseDown={(event) => event.preventDefault()} onClick={() => (onChange({ ingredient: item.name }), setSuggestions([]))}>
                  {item.name}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <input className="note" aria-label={`Note ${n}`} placeholder="note, e.g. finely chopped" value={line.note} onChange={(event) => onChange({ note: event.target.value })} />
      <button type="button" className="quiet remove" aria-label={`Remove line ${n}`} onClick={onRemove}>
        ×
      </button>
    </li>
  );
}
