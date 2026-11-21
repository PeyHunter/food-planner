import { useRef, useState, type FormEvent, type ReactNode } from "react";
import { t } from "../i18n.ts";
import { useSheet } from "../sheet.ts";
import { cancelled, confirmWithPasskey, confirmWithPassword, StepUpError } from "./api.ts";
import "./security.css";

type Asking = { method: StepUpError["method"]; done: (confirmed: boolean) => void };

/**
 * `guard(action)` runs the action; when the server first wants "Confirm it's you", it shows the sheet and,
 * once confirmed, runs the action again. Resolves to undefined when the person cancels.
 */
export function useStepUp(): { guard: <T>(action: () => Promise<T>) => Promise<T | undefined>; sheet: ReactNode } {
  const [asking, setAsking] = useState<Asking>();
  const guard = async <T,>(action: () => Promise<T>) => {
    try {
      return await action();
    } catch (error) {
      if (!(error instanceof StepUpError)) throw error;
      const confirmed = await new Promise<boolean>((done) => setAsking({ method: error.method, done }));
      setAsking(undefined);
      return confirmed ? await action() : undefined;
    }
  };
  return { guard, sheet: asking && <StepUpSheet method={asking.method} onDone={asking.done} /> };
}

function StepUpSheet({ method, onDone }: { method: Asking["method"]; onDone: (confirmed: boolean) => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useSheet(ref);
  const [problem, setProblem] = useState<string>();
  const [busy, setBusy] = useState(false);

  const confirm = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const password = new FormData(event.currentTarget).get("password");
    setBusy(true);
    setProblem(undefined);
    try {
      await (method === "passkey" ? confirmWithPasskey() : confirmWithPassword(String(password ?? "")));
      onDone(true);
    } catch (error) {
      if (!cancelled(error)) setProblem((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <dialog ref={ref} className="sheet step-up" aria-label={t("Confirm it's you")} onClose={() => onDone(false)}>
      <form onSubmit={confirm}>
        <h2>{t("Confirm it's you")}</h2>
        <p className="hint">
          {method === "passkey"
            ? t("This changes how you log in, so use Face ID or your fingerprint first.")
            : t("This changes how you log in, so type your password first.")}
        </p>
        {method === "password" && (
          <label>
            {t("Password")}
            <input name="password" type="password" autoComplete="current-password" required autoFocus />
          </label>
        )}
        {problem && <p role="alert">{problem}</p>}
        <div className="actions">
          <button type="submit" className="btn mint" disabled={busy}>
            {method === "passkey" ? t("Use Face ID / fingerprint") : t("Confirm")}
          </button>
          <button type="button" className="btn white" onClick={() => onDone(false)}>
            {t("Cancel")}
          </button>
        </div>
      </form>
    </dialog>
  );
}
