import { useState } from "react";
import { turnShareOff, turnShareOn } from "./api.ts";

/** Share button (iPhone share sheet, or copy the link) and the switch that turns the link off. `shareUrl` comes with the recipe. */
export function SharePanel({ recipeId, title, shareUrl }: { recipeId: string; title: string; shareUrl: string | null }) {
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
          Share recipe
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
