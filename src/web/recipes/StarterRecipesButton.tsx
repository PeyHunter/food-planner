import { useState } from "react";
import { t } from "../i18n.ts";
import { addStarterRecipes } from "./api.ts";

/** On an empty recipe book: puts in fifteen everyday family dinners to start from. */
export function StarterRecipesButton({ onAdded }: { onAdded: () => void }) {
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string>();
  return (
    <>
      <button
        type="button"
        className="ink-button"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          addStarterRecipes().then(onAdded, (error: Error) => (setProblem(error.message), setBusy(false)));
        }}
      >
        {busy ? t("Adding…") : t("Add 15 starter recipes")}
      </button>
      {problem && <p role="alert">{problem}</p>}
    </>
  );
}
