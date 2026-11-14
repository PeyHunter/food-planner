import { useEffect, useState } from "react";
import { getShareLink, turnShareOff, turnShareOn } from "./api.ts";

/** Share button (iPhone share sheet, or copy the link) and the switch that turns the link off. */
export function SharePanel({ recipeId, title }: { recipeId: string; title: string }) {
  const [link, setLink] = useState<string | null>();
  const [note, setNote] = useState<string>();
  const [problem, setProblem] = useState<string>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    getShareLink(recipeId).then(
      (share) => setLink(share.url),
      (error: Error) => setProblem(error.message),
    );
  }, [recipeId]);

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
        <button type="button" className="ink-button small" disabled={busy || link === undefined} onClick={() => void share()}>
          Share recipe
        </button>
      </div>
      <label className="switch">
        <input type="checkbox" role="switch" checked={!!link} disabled={busy || link === undefined} onChange={(event) => void toggle(event.target.checked)} />
        <span>Share link on</span>
      </label>
      {link ? (
        <p className="hint share-url">Anyone with this link can see the recipe, no login needed: {link}</p>
      ) : (
        link === null && <p className="hint">The link is off. Only you two can see this recipe.</p>
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
