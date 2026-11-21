import { useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { t } from "../i18n.ts";
import { builtInTags, kidTags, mainTypes, type IngredientSuggestion, type MainType, type PhotoRecipeDraft, type RecipeInput } from "../../shared/recipes.ts";
import { isUnit, units } from "../../shared/units.ts";
import { didYouMean, guessShopSection } from "../../shared/groceries.ts";
import { useKids } from "../kitchen.ts";
import { createRecipe, deleteRecipe, getRecipe, go, suggestIngredients, updateRecipe, uploadPhoto } from "./api.ts";
import { sectionColour } from "./section-colour.ts";

// Form fields hold text while typing; they become numbers on save.
type LineDraft = { amount: string; unit: string; ingredient: string; note: string };
type Draft = {
  title: string;
  description: string;
  feeds: string;
  minutes: string;
  types: MainType[];
  tags: string[];
  otherTags: string;
  ageFrom: string;
  ageTo: string;
  lines: LineDraft[];
  steps: string[];
};

// The unit starts as "—" so the blank row at the end doesn't read as a real "200 g" line; typing an amount picks g.
const emptyLine = (): LineDraft => ({ amount: "", unit: "", ingredient: "", note: "" });
const isEmptyLine = (line: LineDraft) => !line.amount && !line.ingredient && !line.note && !line.unit;
const blank: Draft = { title: "", description: "", feeds: "4", minutes: "", types: [], tags: [], otherTags: "", ageFrom: "", ageTo: "", lines: [emptyLine()], steps: [""] };

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
    minutes: numberOrNull(draft.minutes),
    types: draft.types,
    tags: [...new Set([...draft.tags, ...otherTags])],
    ageFromMonths: numberOrNull(draft.ageFrom),
    ageToMonths: numberOrNull(draft.ageTo),
    lines: draft.lines
      .filter((line) => line.ingredient.trim() || line.amount.trim())
      .map((line) => {
        const amount = numberOrNull(line.amount);
        if (Number.isNaN(amount)) throw new Error(t("The amount for {name} must be a number, like 2 or 0.5.", { name: line.ingredient || t("an ingredient") }));
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
export type FromPhoto = PhotoRecipeDraft & { photos: File[]; intro?: string };

function dataUrlToFile(dataUrl: string, name: string) {
  const [head = "", base64 = ""] = dataUrl.split(",");
  const type = /^data:([^;]+)/.exec(head)?.[1] ?? "image/jpeg";
  return new File([Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))], name, { type });
}

/** The main photo a scanned recipe starts with: the dish picture cut out of the book, if the page had one. The pages themselves go in the gallery. */
const startPhoto = (fromPhoto?: FromPhoto) => (fromPhoto?.dishPhoto ? dataUrlToFile(fromPhoto.dishPhoto, "dish.jpg") : undefined);

function photoDraft({ recipe }: FromPhoto): Draft {
  const isBuiltIn = (tag: string) => (builtInTags as readonly string[]).includes(tag);
  return {
    ...blank,
    title: recipe.title,
    description: recipe.description ?? "",
    feeds: String(recipe.feeds),
    minutes: recipe.minutes == null ? "" : String(recipe.minutes),
    types: recipe.types,
    tags: recipe.tags.filter(isBuiltIn),
    otherTags: recipe.tags.filter((tag) => !isBuiltIn(tag)).join(", "),
    lines: [...recipe.lines.map((line) => ({ amount: line.amount === null ? "" : String(line.amount), unit: line.unit ?? "", ingredient: line.ingredient, note: line.note })), emptyLine()],
    steps: [...recipe.steps, ""],
  };
}

export function RecipeForm({ id, start, fromPhoto }: { id?: string; start?: Prefill; fromPhoto?: FromPhoto }) {
  const [draft, setDraft] = useState<Draft | undefined>(id ? undefined : fromPhoto ? photoDraft(fromPhoto) : start ? startDraft(start) : blank);
  const kids = useKids();
  const [keepPhotos, setKeepPhotos] = useState(true);
  const [started] = useState(() => startPhoto(fromPhoto));
  const [photo, setPhoto] = useState<File | undefined>(started);
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
          minutes: recipe.minutes === null ? "" : String(recipe.minutes),
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
    setBusy(t("Saving…"));
    setProblem(undefined);
    try {
      const input = toInput(draft);
      const saved = id ? await updateRecipe(id, input) : await createRecipe(input);
      if (photo) {
        setBusy(t("Uploading photo… 0%"));
        // Once all of it is sent, the server still has to shrink it.
        await uploadPhoto(saved.id, photo, "main", (sent) => setBusy(sent < 1 ? t("Uploading photo… {n}%", { n: Math.round(sent * 100) }) : t("Saving…")));
      }
      if (fromPhoto && keepPhotos) {
        setBusy(t("Saving the recipe photo…"));
        for (const page of fromPhoto.photos) await uploadPhoto(saved.id, page, "gallery");
      }
      go(`/recipes/${saved.id}`);
    } catch (error) {
      setProblem((error as Error).message);
      setBusy(undefined);
    }
  };

  const remove = async () => {
    if (!id || !window.confirm(t('Delete "{title}"? This can\'t be undone.', { title: draft.title }))) return;
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
        <h2>{id ? t("Edit recipe") : fromPhoto ? t("Check the recipe") : t("New recipe")}</h2>
      </nav>
      {!id && !fromPhoto && (
        <div className="row">
          <a className="ink-button white small" href="#/recipes/from-link">
            {t("From a link")}
          </a>
          <a className="ink-button white small" href="#/recipes/from-photo">
            {t("Photo to recipe")}
          </a>
        </div>
      )}
      {fromPhoto && (
        <div className="hint">
          <p>{fromPhoto.intro ?? t("Read from your photo. Check it, fix anything that's wrong, then save.")}</p>
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
        {t("Name")}
        <input value={draft.title} onChange={(event) => set({ title: event.target.value })} required maxLength={200} />
      </label>
      <label>
        {t("Description")}
        <textarea rows={3} value={draft.description} onChange={(event) => set({ description: event.target.value })} maxLength={2000} placeholder={t("A few words about the dish")} />
      </label>
      <div className="narrow-row">
        <label className="narrow">
          {t("Feeds (people)")}
          <input type="number" inputMode="numeric" min={1} max={100} value={draft.feeds} onChange={(event) => set({ feeds: event.target.value })} required />
        </label>
        <label className="narrow">
          {t("Time (minutes)")}
          <input type="number" inputMode="numeric" min={1} max={10080} placeholder="45" value={draft.minutes} onChange={(event) => set({ minutes: event.target.value })} />
        </label>
      </div>

      <fieldset>
        <legend>{t("Main type")}</legend>
        <div className="chips">
          {mainTypes.map((type) => (
            <button key={type} type="button" className="chip" aria-pressed={draft.types.includes(type)} onClick={() => set({ types: toggle(draft.types, type) })}>
              {t(type)}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset>
        <legend>{t("Tags")}</legend>
        <div className="chips">
          {builtInTags.filter((tag) => kids || !kidTags.includes(tag)).map((tag) => (
            <button key={tag} type="button" className="chip" aria-pressed={draft.tags.includes(tag)} onClick={() => set({ tags: toggle(draft.tags, tag) })}>
              {t(tag)}
            </button>
          ))}
        </div>
        <label>
          {t("Other tags (put a comma between them)")}
          <input value={draft.otherTags} onChange={(event) => set({ otherTags: event.target.value })} placeholder={t("quick, summer")} />
        </label>
      </fieldset>

      {kids && (
        <fieldset>
          <legend>{t("For babies and kids (leave empty if not)")}</legend>
          <div className="row ages">
            <label>
              {t("Suits babies from (months)")}
              <input type="number" inputMode="numeric" min={0} max={240} value={draft.ageFrom} onChange={(event) => set({ ageFrom: event.target.value })} />
            </label>
            <label>
              {t("to (months)")}
              <input type="number" inputMode="numeric" min={0} max={240} value={draft.ageTo} onChange={(event) => set({ ageTo: event.target.value })} />
            </label>
          </div>
        </fieldset>
      )}

      <fieldset>
        <legend>{t("Ingredients")}</legend>
        <ol className="line-rows">
          {draft.lines.map((line, index) => (
            <IngredientRow key={index} index={index} line={line} onChange={(change) => setLine(index, change)} onRemove={() => set({ lines: draft.lines.filter((_, at) => at !== index) })} />
          ))}
        </ol>
        <button type="button" className="ink-button white small" onClick={() => set({ lines: [...draft.lines, emptyLine()] })}>
          {t("+ Add ingredient")}
        </button>
      </fieldset>

      <fieldset>
        <legend>{t("Steps")}</legend>
        <ol className="step-rows">
          {draft.steps.map((step, index) => (
            <li key={index}>
              <GrowingTextarea aria-label={t("Step {n}", { n: index + 1 })} value={step} onChange={(text) => setStep(index, text)} />
            </li>
          ))}
        </ol>
        <button type="button" className="ink-button white small" onClick={() => set({ steps: [...draft.steps, ""] })}>
          {t("+ Add step")}
        </button>
      </fieldset>

      <fieldset>
        <legend>{t("Main photo")}</legend>
        {preview && <img className="preview" src={preview} alt={t("New main photo")} />}
        {started && photo === started && <p className="hint">{t("The dish picture from the book. Pick another photo if it isn't right.")}</p>}
        {fromPhoto && !started && <p className="hint">{t("No dish picture on the page. Add one when you've made it.")}</p>}
        <label className="ink-button white small file-button">
          {photo ? t("Pick another photo") : id ? t("Change main photo") : t("Pick a photo")}
          <input type="file" accept="image/*" aria-label="Main photo" onChange={(event) => setPhoto(event.target.files?.[0])} />
        </label>
      </fieldset>

      {fromPhoto && fromPhoto.photos.length > 0 && (
        <label className="check">
          <input type="checkbox" checked={keepPhotos} onChange={(event) => setKeepPhotos(event.target.checked)} />
          {t("Keep the recipe pages as gallery photos")}
        </label>
      )}

      {problem && <p role="alert">{problem}</p>}
      <button type="submit" className="ink-button big" disabled={busy !== undefined}>
        {busy ?? t("Save recipe")}
      </button>
      {id && (
        <button type="button" className="ink-button white small danger" onClick={remove}>
          {t("Delete recipe")}
        </button>
      )}
    </form>
  );
}

function IngredientRow({ index, line, onChange, onRemove }: { index: number; line: LineDraft; onChange: (change: Partial<LineDraft>) => void; onRemove: () => void }) {
  const [suggestions, setSuggestions] = useState<IngredientSuggestion[]>([]);
  const [focused, setFocused] = useState(false);
  const n = index + 1;
  const name = line.ingredient.trim();
  const guess = useMemo(() => (name ? { section: guessShopSection(name), fixes: didYouMean(name) } : undefined), [name]);

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
    <li className={isEmptyLine(line) ? "line-row blank" : "line-row"}>
      <div className="suggest-wrap">
        <input
          aria-label={`Ingredient ${n}`}
          placeholder={t("Add an ingredient")}
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
      <input className="amount" aria-label={`Amount ${n}`} inputMode="decimal"
        value={line.amount}
        onChange={(event) => onChange(!line.amount && !line.unit && event.target.value ? { amount: event.target.value, unit: "g" } : { amount: event.target.value })}
      />
      <select aria-label={`Unit ${n}`} value={line.unit} onChange={(event) => onChange({ unit: event.target.value })}>
        <option value="">—</option>
        {units.map((unit) => (
          <option key={unit} value={unit}>
            {t(unit)}
          </option>
        ))}
      </select>
      <input className="note" aria-label={`Note ${n}`} placeholder={t("note, e.g. chopped")} value={line.note} onChange={(event) => onChange({ note: event.target.value })} />
      <button type="button" className="remove" aria-label={t("Remove line {n}", { n })} onClick={onRemove}>
        ✕
      </button>
      {guess && (
        <div className="line-hint" aria-label={`Shop section, line ${n}`}>
          <span className={`sticker ${sectionColour[guess.section]}`}>{t(guess.section)}</span>
          {guess.fixes.length > 0 && (
            <>
              <span className="did-you-mean">{t("Did you mean:")}</span>
              {guess.fixes.map((fix) => (
                <button key={fix} type="button" className="chip" onClick={() => onChange({ ingredient: fix })}>
                  {fix}?
                </button>
              ))}
            </>
          )}
        </div>
      )}
    </li>
  );
}

/** A step box that grows with its text, so a long step is never cut off. */
function GrowingTextarea({ value, onChange, ...rest }: { value: string; onChange: (text: string) => void; "aria-label": string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const box = ref.current;
    if (!box) return;
    box.style.blockSize = "auto";
    box.style.blockSize = `${box.scrollHeight + 6}px`;
  }, [value]);
  return <textarea ref={ref} rows={2} className="grow" value={value} onChange={(event) => onChange(event.target.value)} {...rest} />;
}
