import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { amountOf, buildSendList, copyText, fullWord, itemUrl, maxLink, maxWord, nemligHome, nemligLink, type Remembered, type SendItem } from "../../shared/nemlig.ts";
import type { Organic, Profile } from "../../shared/profile.ts";
import type { ShoppingView } from "../../shared/shopping.ts";
import { currentLanguage, t } from "../i18n.ts";
import { saveProfile } from "../profile/api.ts";
import { NemligSettings } from "../profile/NemligSettings.tsx";
import { getRemembered, remember } from "./api.ts";
import "./nemlig.css";

type Setup = "account" | "settings" | "ready";
type Stage = Setup | "check" | "fill" | "done";

/** What a send has done so far, kept on the phone per week so a reload carries on where it was. */
type Saved = {
  stage: "check" | "fill" | "done";
  /** Items left out of this send. */
  removed: string[];
  /** Words changed for extras, which have no ingredient to remember them on. */
  extraWords: Record<string, string>;
  /** The items being put in the basket, fixed when "Fill the basket" starts. */
  items: SendItem[];
  at: number;
  added: string[];
  tickOff: boolean;
  /** False after Close: the progress stays for next time, but a reload does not pop the sheet up again. */
  open: boolean;
};

const fresh = (): Saved => ({ stage: "check", removed: [], extraWords: {}, items: [], at: 0, added: [], tickOff: true, open: true });
const storageKey = (monday: string) => `nemlig-send:${monday}`;
function load(monday: string): Saved | undefined {
  try {
    const text = localStorage.getItem(storageKey(monday));
    return text ? { ...fresh(), ...(JSON.parse(text) as Partial<Saved>) } : undefined;
  } catch {
    return undefined;
  }
}
/** True when a send for that week was left open, so Shopping can carry on with it after a reload. */
export const hasSend = (monday: string) => load(monday)?.open === true;
function store(monday: string, saved: Saved | undefined) {
  try {
    if (saved) localStorage.setItem(storageKey(monday), JSON.stringify(saved));
    else localStorage.removeItem(storageKey(monday));
  } catch {
    // Not kept; the send still works until the page closes.
  }
}

/** One nemlig.com tab, reused for every item, so the phone does not fill up with tabs. */
function openNemlig(url: string) {
  const tab = window.open(url, "nemlig");
  if (tab) tab.opener = null;
}

type Props = {
  monday: string;
  view: ShoppingView;
  nemlig: Profile["nemlig"];
  isTicked: (key: string, fromServer: boolean) => boolean;
  onNemlig: (nemlig: Profile["nemlig"]) => void;
  onTickOff: (keys: string[]) => Promise<void>;
  onClose: () => void;
};

/** "Send list to nemlig.com": first-time setup, then check the list, fill the nemlig basket one item at a time, and tick off what went in. */
export function NemligSend({ monday, view, nemlig, isTicked, onNemlig, onTickOff, onClose }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const [saved, setSaved] = useState<Saved>(() => load(monday) ?? fresh());
  const [stage, setStage] = useState<Stage>(() => (!nemlig.on ? "account" : saved.stage !== "check" && saved.items.length === 0 ? "check" : saved.stage));
  const [settings, setSettings] = useState({ day: nemlig.day, organic: nemlig.organic });
  const [remembered, setRemembered] = useState<Record<string, Remembered>>();
  const [problem, setProblem] = useState<string>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (ref.current && !ref.current.open) ref.current.showModal();
    if (load(monday)) update({ open: true });
    getRemembered().then(setRemembered, () => setRemembered({}));
  }, []);

  const update = (change: Partial<Saved>) =>
    setSaved((before) => {
      const next = { ...before, ...change };
      store(monday, next);
      return next;
    });
  const go = (next: Stage) => {
    setProblem(undefined);
    setStage(next);
    if (next === "check" || next === "fill" || next === "done") update({ stage: next });
    ref.current?.scrollTo({ top: 0 });
  };

  const all = buildSendList(view, { remembered, organic: nemlig.organic, ticked: isTicked }).map((item) =>
    saved.extraWords[item.key] ? { ...item, word: saved.extraWords[item.key]! } : item,
  );
  const items = all.filter((item) => !saved.removed.includes(item.key));
  const removed = all.filter((item) => saved.removed.includes(item.key));

  const finish = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (saved.tickOff && saved.added.length) await onTickOff(saved.added);
      store(monday, undefined);
      onClose();
    } catch (error) {
      setProblem((error as Error).message);
    } finally {
      setBusy(false);
    }
  };
  // Closing on the last step counts as done, so ticks are not lost.
  const close = () => {
    if (stage === "done") return void finish();
    if (load(monday)) update({ open: false });
    onClose();
  };

  const saveSetup = async () => {
    setBusy(true);
    try {
      const profile = await saveProfile({ nemlig: { on: true, day: settings.day, organic: settings.organic } });
      onNemlig(profile.nemlig);
      go("check");
    } catch (error) {
      setProblem((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const saveWord = async (item: SendItem, word: string, link: string | null) => {
    if (item.ingredientId === null) {
      update({ extraWords: { ...saved.extraWords, [item.key]: word } });
      return;
    }
    const kept = await remember(item.ingredientId, { word, link });
    setRemembered((before) => ({ ...before, [item.ingredientId!]: kept }));
  };

  const startFill = () => {
    update({ items, at: 0, added: [], stage: "fill" });
    setStage("fill");
  };

  const fill = saved.items;
  const current = fill[saved.at];
  const answer = (inBasket: boolean) => {
    if (!current) return;
    const added = saved.added.filter((key) => key !== current.key);
    const next = saved.at + 1;
    update({ added: inBasket ? [...added, current.key] : added, at: next, stage: next >= fill.length ? "done" : "fill" });
    if (next >= fill.length) setStage("done");
  };

  const back = (() => {
    switch (stage) {
      case "account":
        return undefined;
      case "settings":
        return () => go("account");
      case "ready":
        return () => go("settings");
      case "check":
        return undefined;
      case "fill":
        return () => (saved.at > 0 ? update({ at: saved.at - 1 }) : go("check"));
      case "done":
        return () => {
          update({ at: Math.max(0, fill.length - 1) });
          go("fill");
        };
    }
  })();

  const setupStep = stage === "account" ? 1 : stage === "settings" ? 2 : stage === "ready" ? 3 : 0;
  const title =
    stage === "account" || stage === "settings" || stage === "ready" ? t("Set up nemlig.com") : stage === "check" ? t("Check the list") : stage === "fill" ? t("Fill the basket") : t("All done");

  return (
    <dialog ref={ref} className="nemlig-send" aria-label={title} onCancel={(event) => (event.preventDefault(), close())}>
      <header className="ns-head">
        <button type="button" className="btn small white" onClick={back ?? close}>
          <span aria-hidden="true">←</span> {t("Back")}
        </button>
        <h2>{title}</h2>
        <button type="button" className="ns-close" aria-label={t("Close")} onClick={close}>
          ×
        </button>
      </header>
      {setupStep > 0 && (
        <p className="ns-steps" aria-label={t("Step {n} of {total}", { n: setupStep, total: 3 })}>
          {[1, 2, 3].map((step) => (
            <span key={step} className={step <= setupStep ? "on" : ""} />
          ))}
          <small>{t("Step {n} of {total}", { n: setupStep, total: 3 })}</small>
        </p>
      )}
      {problem && <p role="alert">{problem}</p>}

      {stage === "account" && <Account onNext={() => go("settings")} />}
      {stage === "settings" && (
        <Body foot={<Primary onClick={() => go("ready")}>{t("Next")}</Primary>}>
          <h3 className="ns-big">{t("When and how?")}</h3>
          <NemligSettings day={settings.day} organic={settings.organic} onDay={(day) => setSettings({ ...settings, day })} onOrganic={(organic: Organic) => setSettings({ ...settings, organic })} />
          <p className="ns-note">{t("You pick the exact delivery time on nemlig.com when you pay.")}</p>
        </Body>
      )}
      {stage === "ready" && (
        <Body
          foot={
            <Primary onClick={() => void saveSetup()} disabled={busy}>
              {t("Send my list")} <span aria-hidden="true">→</span>
            </Primary>
          }
        >
          <div className="ns-hero">
            <span className="ns-badge sticker sun tilt-r" aria-hidden="true">
              ✓
            </span>
            <h3 className="ns-big">{t("All set!")}</h3>
            <p>{t("Next time, the button takes you straight to your list.")}</p>
          </div>
          <ol className="ns-how">
            <li>{t("Check the list and fix any search words.")}</li>
            <li>{t("Go through it one item at a time and put each in your nemlig.com basket.")}</li>
            <li>{t("Pick a delivery time and pay on nemlig.com.")}</li>
          </ol>
        </Body>
      )}

      {stage === "check" && (
        <Check
          items={items}
          removed={removed}
          loading={remembered === undefined}
          onRemove={(key) => update({ removed: [...saved.removed, key] })}
          onPutBack={() => update({ removed: [] })}
          onSave={saveWord}
          onFill={startFill}
        />
      )}

      {stage === "fill" && current && <Fill item={current} at={saved.at} total={fill.length} added={saved.added.includes(current.key)} onAnswer={answer} />}

      {stage === "done" && (
        <Body
          foot={
            <>
              <Primary onClick={() => openNemlig(nemligHome)}>
                {t("Open nemlig.com")} <span aria-hidden="true">↗</span>
              </Primary>
              <button type="button" className="btn white" onClick={() => void finish()} disabled={busy}>
                {t("Finish")}
              </button>
            </>
          }
        >
          <div className="ns-hero">
            <span className="ns-badge sticker mint tilt-l" aria-hidden="true">
              🛒
            </span>
            <h3 className="ns-big">
              {saved.added.length === fill.length ? t("All in your basket.") : t("{n} of {total} in your basket.", { n: saved.added.length, total: fill.length })}
            </h3>
            <p>{t("Open nemlig.com to pick a delivery time and pay.")}</p>
          </div>
          {saved.added.length < fill.length && (
            <p className="ns-note">
              {t("Skipped:")} {fill.filter((item) => !saved.added.includes(item.key)).map((item) => item.name).join(", ")}
            </p>
          )}
          {saved.added.length > 0 && (
            <label className="ns-toggle toggle">
              <input type="checkbox" role="switch" checked={saved.tickOff} onChange={(event) => update({ tickOff: event.target.checked })} />
              <span>{t("Tick them off the shopping list ({n})", { n: saved.added.length })}</span>
            </label>
          )}
        </Body>
      )}
    </dialog>
  );
}

function Body({ children, foot }: { children: ReactNode; foot?: ReactNode }) {
  return (
    <>
      <div className="ns-body">{children}</div>
      {foot && <div className="ns-foot">{foot}</div>}
    </>
  );
}

function Primary({ children, onClick, disabled }: { children: ReactNode; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" className="btn sun ns-primary" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  );
}

function Account({ onNext }: { onNext: () => void }) {
  const [making, setMaking] = useState(false);
  return (
    <Body>
      <h3 className="ns-big">{t("Do you have a nemlig.com account?")}</h3>
      <p>{t("The app opens nemlig.com for you. You put things in the basket, pick a time and pay there.")}</p>
      <div className="ns-choices">
        <button type="button" className="btn sun ns-primary" onClick={onNext}>
          {making ? t("I have one now") : t("Yes, I have one")}
        </button>
        <button
          type="button"
          className="btn white"
          onClick={() => {
            setMaking(true);
            openNemlig(nemligHome);
          }}
        >
          {t("Make one")} <span aria-hidden="true">↗</span>
        </button>
      </div>
      <p className="ns-tip">
        <strong>{t("Tip:")}</strong> {t("Log in on nemlig.com in this browser once. Then every item opens straight into your own basket.")}
      </p>
    </Body>
  );
}

type CheckProps = {
  items: SendItem[];
  removed: SendItem[];
  loading: boolean;
  onRemove: (key: string) => void;
  onPutBack: () => void;
  onSave: (item: SendItem, word: string, link: string | null) => Promise<void>;
  onFill: () => void;
};

function Check({ items, removed, loading, onRemove, onPutBack, onSave, onFill }: CheckProps) {
  const [editing, setEditing] = useState<string>();
  const [copied, setCopied] = useState<"yes" | "no">();
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(copyText(items));
      setCopied("yes");
    } catch {
      setCopied("no");
    }
  };
  return (
    <Body
      foot={
        <Primary onClick={onFill} disabled={loading || items.length === 0}>
          {t("Fill the basket")} ({items.length}) <span aria-hidden="true">→</span>
        </Primary>
      }
    >
      <p>{t("This is what we look for on nemlig.com. Change a word if it finds the wrong thing.")}</p>
      {items.length === 0 && <p className="ns-note">{t("Nothing left to send.")}</p>}
      <ul className="ns-list">
        {items.map((item) =>
          editing === item.key ? (
            <WordEditor
              key={item.key}
              item={item}
              onCancel={() => setEditing(undefined)}
              onSave={async (word, link) => {
                await onSave(item, word, link);
                setEditing(undefined);
              }}
            />
          ) : (
            <li key={item.key} className="ns-row">
              <div className="ns-what">
                <strong>{item.name}</strong>
                {amountOf(item, currentLanguage()) && <span className="ns-amount">{amountOf(item, currentLanguage())}</span>}
                <span className="ns-word">
                  {item.link ? (
                    <>
                      <span aria-hidden="true">🔗</span> {t("Your nemlig.com product")}
                    </>
                  ) : (
                    <>
                      <span aria-hidden="true">🔍</span> {fullWord(item)}
                    </>
                  )}
                </span>
              </div>
              <div className="ns-row-tools">
                <button type="button" className="btn small white" aria-label={t("Change the search for {name}", { name: item.name })} onClick={() => setEditing(item.key)}>
                  {t("Edit")}
                </button>
                <button type="button" className="ns-remove" aria-label={t("Leave {name} out", { name: item.name })} onClick={() => onRemove(item.key)}>
                  ×
                </button>
              </div>
            </li>
          ),
        )}
      </ul>
      {removed.length > 0 && (
        <p className="ns-note">
          {t("Left out: {names}.", { names: removed.map((item) => item.name).join(", ") })}{" "}
          <button type="button" className="ns-link" onClick={onPutBack}>
            {t("Put back")}
          </button>
        </p>
      )}
      {items.length > 0 && (
        <div className="ns-copy">
          <button type="button" className="btn small white" onClick={() => void copy()}>
            {copied === "yes" ? t("Copied ✓") : t("Copy the list")}
          </button>
          <small>{t("For nemlig.com's own list tools, in Danish.")}</small>
          {copied === "no" && <textarea readOnly aria-label={t("The list as text")} value={copyText(items)} rows={Math.min(items.length, 8)} onFocus={(event) => event.target.select()} />}
        </div>
      )}
    </Body>
  );
}

function WordEditor({ item, onSave, onCancel }: { item: SendItem; onSave: (word: string, link: string | null) => Promise<void>; onCancel: () => void }) {
  const [problem, setProblem] = useState<string>();
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const word = String(form.get("word") ?? "").trim();
    const linkText = item.ingredientId ? String(form.get("link") ?? "").trim() : "";
    const link = linkText ? nemligLink(linkText) : null;
    if (!word) return setProblem(t("Write what to search for."));
    if (link === undefined) return setProblem(t("Paste a link to a nemlig.com page."));
    try {
      await onSave(word, link);
    } catch (error) {
      setProblem((error as Error).message);
    }
  };
  return (
    <li className="ns-row editing">
      <form className="ns-edit" aria-label={t("Search for {name}", { name: item.name })} onSubmit={submit}>
        <strong>{item.name}</strong>
        <label>
          {t("Search word")}
          <input name="word" defaultValue={item.word} maxLength={maxWord} autoFocus />
        </label>
        {item.ingredientId && (
          <label>
            {t("Or paste a nemlig.com product link")}
            <input name="link" type="url" inputMode="url" defaultValue={item.link ?? ""} maxLength={maxLink} placeholder="https://www.nemlig.com/…" />
          </label>
        )}
        <small>{item.ingredientId ? t("We remember this for next week.") : t("Only for this time.")}</small>
        {problem && <p role="alert">{problem}</p>}
        <div className="ns-edit-tools">
          <button type="submit" className="btn small mint">
            {t("Save")}
          </button>
          <button type="button" className="btn small white" onClick={onCancel}>
            {t("Cancel")}
          </button>
        </div>
      </form>
    </li>
  );
}

function Fill({ item, at, total, added, onAnswer }: { item: SendItem; at: number; total: number; added: boolean; onAnswer: (inBasket: boolean) => void }) {
  const [opened, setOpened] = useState(false);
  useEffect(() => setOpened(false), [item.key]);
  const amount = amountOf(item, currentLanguage());
  return (
    <Body
      foot={
        <div className="ns-answer">
          <button type="button" className="btn white" onClick={() => onAnswer(false)}>
            {t("Skip")}
          </button>
          <button type="button" className={opened || added ? "btn mint ns-primary" : "btn white"} onClick={() => onAnswer(true)}>
            <span aria-hidden="true">✓</span> {t("In the basket")}
          </button>
        </div>
      }
    >
      <div className="ns-progress" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={at} aria-label={t("Progress")}>
        <span style={{ inlineSize: `${(at / total) * 100}%` }} />
      </div>
      <article className="ns-card" aria-live="polite">
        <span className="ns-count sticker lilac tilt-l">{t("{n} of {total}", { n: at + 1, total })}</span>
        <h3>{fullWord(item)}</h3>
        <p className="ns-card-amount">{amount || t("No amount")}</p>
        {item.name.toLowerCase() !== item.word.toLowerCase() && <p className="ns-card-name">{t("On your list: {name}", { name: item.name })}</p>}
        <button
          type="button"
          className="btn sun ns-find"
          onClick={() => {
            setOpened(true);
            openNemlig(itemUrl(item));
          }}
        >
          {t("Find on nemlig.com")} <span aria-hidden="true">↗</span>
        </button>
        <p className="ns-note">{t("Put it in the basket there, then come back here.")}</p>
      </article>
    </Body>
  );
}
