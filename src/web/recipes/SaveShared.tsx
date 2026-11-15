import { useEffect, useState } from "react";
import type { SharedRecipe } from "../../shared/recipes.ts";
import { getShared, go, saveShared } from "./api.ts";

/** #/recipes/save/<token>: someone sent a share link; copy that recipe into this kitchen's recipes. */
export function SaveShared({ token }: { token: string }) {
  const [recipe, setRecipe] = useState<SharedRecipe>();
  const [problem, setProblem] = useState<string>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getShared(token).then(setRecipe, (error: Error) => setProblem(error.message));
  }, [token]);

  const save = async () => {
    setBusy(true);
    setProblem(undefined);
    try {
      const { id } = await saveShared(token);
      go(`#/recipes/${id}`);
    } catch (error) {
      setProblem((error as Error).message);
      setBusy(false);
    }
  };

  return (
    <section className="panel save-shared">
      <span className="sticker sun tilt-l">Sent to you</span>
      {recipe && (
        <>
          {recipe.mainPhoto && <img className="save-photo" src={recipe.mainPhoto.smallUrl} alt="" />}
          <h2>{recipe.title}</h2>
          <p>Save a copy in your recipes. You can change your copy without changing theirs.</p>
          <button type="button" className="btn" disabled={busy} onClick={save}>
            {busy ? "Saving…" : "Save to my recipes"}
          </button>
        </>
      )}
      {!recipe && !problem && <p>Loading…</p>}
      {problem && <p role="alert">{problem}</p>}
      <a href="#/recipes">Back to the book</a>
    </section>
  );
}
