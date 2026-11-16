import { useEffect, useState, type ChangeEvent } from "react";
import { t } from "../i18n.ts";
import type { PhotoRecipeDraft } from "../../shared/recipes.ts";
import { photoRecipeReady, readRecipePhotos } from "./api.ts";
import { RecipeForm } from "./RecipeForm.tsx";

const maxPhotos = 10;

/** Photo to recipe: take or pick photos of a written recipe, then check what was read in the normal edit form. */
export function PhotoRecipeScreen() {
  const [ready, setReady] = useState<boolean>();
  const [photos, setPhotos] = useState<File[]>([]);
  const [previews, setPreviews] = useState<string[]>([]);
  const [reading, setReading] = useState(false);
  const [problem, setProblem] = useState<string>();
  const [draft, setDraft] = useState<PhotoRecipeDraft>();

  useEffect(() => {
    photoRecipeReady().then(
      (status) => setReady(status.ready),
      (error: Error) => setProblem(error.message),
    );
  }, []);

  useEffect(() => {
    const urls = photos.map((photo) => URL.createObjectURL(photo));
    setPreviews(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [photos]);

  if (draft) return <RecipeForm fromPhoto={{ ...draft, photos }} />;

  const add = (event: ChangeEvent<HTMLInputElement>) => {
    const picked = [...(event.target.files ?? [])];
    event.target.value = "";
    setProblem(undefined);
    setPhotos((current) => [...current, ...picked].slice(0, maxPhotos));
  };

  const read = async () => {
    setReading(true);
    setProblem(undefined);
    try {
      setDraft(await readRecipePhotos(photos));
    } catch (error) {
      setProblem((error as Error).message);
      setReading(false);
    }
  };

  return (
    <section className="recipe-form photo-recipe">
      <nav className="bar">
        <a className="back" href="#/recipes/list" aria-label="Back">
          ←
        </a>
        <h2>{t("Photo to recipe")}</h2>
      </nav>
      {ready === false && <p role="alert">{t("Photo to recipe isn't set up yet.")}</p>}
      {ready && (
        <>
          <p className="hint">{t("Take a photo of a written or printed recipe. A long recipe can have up to {n} photos.", { n: maxPhotos })}</p>
          {previews.length > 0 && (
            <ul className="photo-pages">
              {previews.map((url, index) => (
                <li key={url}>
                  <img className="preview" src={url} alt={`Recipe photo ${index + 1}`} />
                </li>
              ))}
            </ul>
          )}
          {photos.length < maxPhotos && !reading && (
            <div className="row">
              <label className="ink-button white small file-button">
                {photos.length ? t("Take another photo") : t("Take a photo")}
                <input type="file" accept="image/*" capture="environment" aria-label="Take a photo" onChange={add} />
              </label>
              <label className="ink-button white small file-button">
                {t("Pick photos")}
                <input type="file" accept="image/*" multiple aria-label="Pick photos" onChange={add} />
              </label>
            </div>
          )}
          {photos.length > 0 && (
            <button type="button" className="ink-button big" disabled={reading} onClick={read}>
              {reading ? t("Reading the recipe…") : t("Read the recipe")}
            </button>
          )}
          {reading && (
            <p className="hint" role="status">
              {t("Reading the recipe… This can take a minute or two.")}
            </p>
          )}
          {photos.length > 0 && !reading && (
            <button type="button" className="quiet" onClick={() => setPhotos([])}>
              {t("Start over")}
            </button>
          )}
        </>
      )}
      {problem && <p role="alert">{problem}</p>}
    </section>
  );
}
