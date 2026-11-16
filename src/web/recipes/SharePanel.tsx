import { useState } from "react";
import type { Recipe } from "../../shared/recipes.ts";
import { turnShareOff, turnShareOn } from "./api.ts";
import { recipeImage } from "./recipe-image.ts";

/** Share button (iPhone share sheet, or copy the link), share as a picture, and the switch that turns the link off. */
export function SharePanel({ recipe }: { recipe: Recipe }) {
  const { id: recipeId, title, shareUrl } = recipe;
  const [link, setLink] = useState(shareUrl);
  const [note, setNote] = useState<string>();
  const [problem, setProblem] = useState<string>();
  const [busy, setBusy] = useState(false);

  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setProblem(undefined);
    setNote(undefined);
    try {
      await work();
    } catch (error) {
      setProblem((error as Error).message);
    }
    setBusy(false);
  };

  const share = () =>
    run(async () => {
      const { url } = await turnShareOn(recipeId);
      setLink(url);
      if (!url) return;
      if (navigator.share) {
        try {
          return await navigator.share({ title, url });
        } catch (error) {
          // Closing the share sheet is not a problem.
          if ((error as Error).name === "AbortError") return;
        }
      }
      try {
        await navigator.clipboard.writeText(url);
        setNote("Link copied");
      } catch {
        setNote("Copy the link above to share it.");
      }
    });

  // A JPEG of the whole recipe, for chats where a picture works better than a link. Needs no share link.
  const sharePicture = () =>
    run(async () => {
      const blob = await recipeImage(recipe, { ingredients: "Ingredients", steps: "Steps", feeds: `Feeds ${recipe.feeds}` });
      const file = new File([blob], `${title.replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "") || "recipe"}.jpg`, { type: "image/jpeg" });
      if (navigator.canShare?.({ files: [file] })) {
        try {
          return await navigator.share({ files: [file], title });
        } catch (error) {
          if ((error as Error).name === "AbortError") return;
        }
      }
      // No share sheet for files (most computers): save the picture instead.
      const url = URL.createObjectURL(blob);
      const link = Object.assign(document.createElement("a"), { href: url, download: file.name });
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      setNote("Picture saved");
    });

  const toggle = (on: boolean) =>
    run(async () => {
      const { url } = on ? await turnShareOn(recipeId) : await turnShareOff(recipeId);
      setLink(url);
      if (!on) setNote("Link turned off");
    });

  return (
    <section className="panel share">
      <div className="bar">
        <h2>Share</h2>
        <button type="button" className="ink-button small" disabled={busy} onClick={() => void share()}>
          Share link
        </button>
        <button type="button" className="ink-button small" disabled={busy} onClick={() => void sharePicture()}>
          Share as picture
        </button>
      </div>
      <label className="switch">
        <input type="checkbox" role="switch" aria-label="Share link" checked={!!link} disabled={busy} onChange={(event) => void toggle(event.target.checked)} />
        <span>{link ? "Share link is on" : "Share link is off"}</span>
      </label>
      {link ? (
        <p className="hint share-url">Anyone with this link can see the recipe, no login needed: {link}</p>
      ) : (
        <p className="hint">The link is off. Only you two can see this recipe.</p>
      )}
      {note && (
        <p className="sticker mint tilt-l share-note" role="status">
          {note}
        </p>
      )}
      {problem && <p role="alert">{problem}</p>}
    </section>
  );
}
