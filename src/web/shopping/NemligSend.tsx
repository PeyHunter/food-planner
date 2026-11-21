import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { buildSendList, buyOf, copyText, fullWord, itemUrl, maxLink, maxWord, nemligHome, nemligLink, needOf, type Remembered, type SendItem } from "../../shared/nemlig.ts";
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
  /** Keys already in the nemlig.com basket; kept when going back, so nothing is added twice. */
  added: string[];
  tickOff: boolean;
  /** False after Close: the progress stays for next time, but a reload does not pop the sheet up again. */
  open: boolean;
};

const fresh = (): Saved => ({ stage: "check", removed: [], extraWords: {}, items: [], added: [], tickOff: true, open: true });
const storageKey = (monday: string) => `nemlig-send:${monday}`;
function load(monday: string): Saved | undefined {
  try {
    const text = localStorage.getItem(storageKey(monday));
    if (!text) return undefined;
    const saved = { ...fresh(), ...(JSON.parse(text) as Partial<Saved>) };
    // Sends saved before packs were counted have `measure` instead of `need` and `pack`.
    saved.items = saved.items.map((item) => ({ ...item, need: item.need ?? null, pack: item.pack ?? null, productId: item.productId ?? null }));
    return saved;
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
  const [organic, setOrganic] = useState(nemlig.organic);
  const [remembered, setRemembered] = useState<Record<string, Remembered>>();
  const [problem, setProblem] = useState<string>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (ref.current && !ref.current.open) ref.current.showModal();
    if (load(monday)) update({ open: true });
    getRemembered().then(setRemembered, () => setRemembered({}));
  }, []);

  // A new step puts focus on its heading, so keyboard and screen reader users start at the top of it.
  const shownStage = useRef(stage);
  useEffect(() => {
    if (shownStage.current === stage) return;
    shownStage.current = stage;
    const dialog = ref.current;
    (dialog?.querySelector<HTMLElement>(".ns-body h3") ?? dialog?.querySelector<HTMLElement>(".ns-head h2"))?.focus();
  }, [stage]);

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
      const profile = await saveProfile({ nemlig: { on: true, organic } });
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

  // What is already in the basket stays there: going back and starting again carries on with the rest.
  const startFill = () => {
    update({ items, added: saved.added.filter((key) => items.some((item) => item.key === key)), stage: "fill" });
    setStage("fill");
  };

  const fill = saved.items;
  const toggleAdded = (key: string) => update({ added: saved.added.includes(key) ? saved.added.filter((one) => one !== key) : [...saved.added, key] });

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
        return () => go("check");
      case "done":
        return () => go("fill");
    }
  })();

  const setupStep = stage === "account" ? 1 : stage === "settings" ? 2 : stage === "ready" ? 3 : 0;
  const title =
    stage === "account" || stage === "settings" || stage === "ready" ? t("Set up nemlig.com") : stage === "check" ? t("Check the list") : stage === "fill" ? t("Fill the basket") : t("All done");

  return (
    <dialog ref={ref} className="nemlig-send" aria-label={title} onCancel={(event) => (event.preventDefault(), close())}>
      <header className="ns-head">
        {back ? (
          <button type="button" className="btn small white" onClick={back}>
            <span aria-hidden="true">←</span> {t("Back")}
          </button>
        ) : (
          <span />
        )}
        <h2 tabIndex={-1}>{title}</h2>
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
          <h3 className="ns-big" tabIndex={-1}>{t("Organic?")}</h3>
          <NemligSettings organic={organic} onOrganic={(choice: Organic) => setOrganic(choice)} />
          <p className="ns-note">{t("You pick the delivery day and time on nemlig.com when you pay.")}</p>
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
            <h3 className="ns-big" tabIndex={-1}>{t("All set!")}</h3>
            <p>{t("Next time, the button takes you straight to your list.")}</p>
          </div>
          <ol className="ns-how">
            <li>{t("Check the list and fix any search words.")}</li>
            <li>{t("Open each item on nemlig.com, add it there, and tick it here.")}</li>
            <li>{t("Pick a delivery time and pay on nemlig.com.")}</li>
          </ol>
        </Body>
      )}

      {stage === "check" && (
        <Check
          items={items}
          added={saved.added}
          removed={removed}
          loading={remembered === undefined}
          onRemove={(key) => update({ removed: [...saved.removed, key] })}
          onPutBack={() => update({ removed: [] })}
          onSave={saveWord}
          onFill={startFill}
        />
      )}

      {stage === "fill" && <Fill items={fill} added={saved.added} onToggle={toggleAdded} onNext={() => go("done")} />}

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
            <h3 className="ns-big" tabIndex={-1}>
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
      <h3 className="ns-big" tabIndex={-1}>{t("Do you have a nemlig.com account?")}</h3>
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
        <strong>{t("Tip:")}</strong> {t("Log in on nemlig.com once in the browser this app opens (Safari on an iPhone). Then every item opens straight into your own basket.")}
      </p>
    </Body>
  );
}

type CheckProps = {
  items: SendItem[];
  added: string[];
  removed: SendItem[];
  loading: boolean;
  onRemove: (key: string) => void;
  onPutBack: () => void;
  onSave: (item: SendItem, word: string, link: string | null) => Promise<void>;
  onFill: () => void;
};

function Check({ items, added, removed, loading, onRemove, onPutBack, onSave, onFill }: CheckProps) {
  const [editing, setEditing] = useState<string>();
  const [copied, setCopied] = useState<"yes" | "no">();
  const list = useRef<HTMLUListElement>(null);
  const edited = useRef<string | undefined>(undefined);
  // After Save or Cancel, focus goes back to that row's Edit button.
  useEffect(() => {
    if (editing !== undefined || edited.current === undefined) return;
    list.current?.querySelector<HTMLElement>(`[data-key="${CSS.escape(edited.current)}"] .ns-edit-button`)?.focus();
    edited.current = undefined;
  }, [editing]);
  const stopEditing = () => {
    edited.current = editing;
    setEditing(undefined);
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(copyText(items));
      setCopied("yes");
    } catch {
      setCopied("no");
    }
  };
  const left = items.filter((item) => !added.includes(item.key)).length;
  return (
    <Body
      foot={
        // Hidden while a word is edited, so it never covers Save (or sits over the phone keyboard).
        editing === undefined && (
          <Primary onClick={onFill} disabled={loading || items.length === 0}>
            {left < items.length ? t("Carry on adding ({n} left)", { n: left }) : t("Start adding to nemlig.com ({n})", { n: items.length })} <span aria-hidden="true">→</span>
          </Primary>
        )
      }
    >
      <p>{t("This is what we look for on nemlig.com. Change a word if it finds the wrong thing.")}</p>
      {items.length === 0 && <p className="ns-note">{t("Nothing left to send.")}</p>}
      <ul className="ns-list" ref={list}>
        {items.map((item) =>
          editing === item.key ? (
            <WordEditor
              key={item.key}
              item={item}
              onCancel={stopEditing}
              onSave={async (word, link) => {
                await onSave(item, word, link);
                stopEditing();
              }}
            />
          ) : (
            <li key={item.key} data-key={item.key} className={`ns-row${added.includes(item.key) ? " done" : ""}`}>
              <div className="ns-what">
                <strong>{item.name}</strong>
                <ItemFacts item={item} />
                {added.includes(item.key) && <span className="ns-in">✓ {t("In your basket")}</span>}
              </div>
              <div className="ns-row-tools">
                <button type="button" className="btn small white ns-edit-button" aria-label={t("Change the search for {name}", { name: item.name })} onClick={() => setEditing(item.key)}>
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
          <small>{t("Copies the list as Danish text, to paste in a note or a message. It does not fill the nemlig.com basket.")}</small>
          {copied === "no" && <textarea readOnly aria-label={t("The list as text")} value={copyText(items)} rows={Math.min(items.length, 8)} onFocus={(event) => event.target.select()} />}
        </div>
      )}
    </Body>
  );
}

/** What to buy (packs when known, else the amount needed) and the search word, under an item's name. */
function ItemFacts({ item }: { item: SendItem }) {
  const language = currentLanguage();
  const buy = buyOf(item, language);
  const need = needOf(item, language);
  return (
    <>
      {buy ? <span className="ns-amount">{buy}</span> : need && <span className="ns-amount need">{t("You need {amount}", { amount: need })}</span>}
      {item.organic && <span className="ns-organic">{t("Organic")}</span>}
      {buy && need && <span className="ns-need">{t("Recipes use {amount}", { amount: need })}</span>}
      <span className="ns-word">
        {item.link ? (
          <>
            <span aria-hidden="true">🔗</span> {t("Your nemlig.com product")}
          </>
        ) : item.productId ? (
          <>
            <span aria-hidden="true">🔗</span> {t("nemlig.com product")}
          </>
        ) : (
          <>
            <span aria-hidden="true">🔍</span> {fullWord(item)}
          </>
        )}
      </span>
    </>
  );
}

function WordEditor({ item, onSave, onCancel }: { item: SendItem; onSave: (word: string, link: string | null) => Promise<void>; onCancel: () => void }) {
  const [problem, setProblem] = useState<string>();
  const row = useRef<HTMLLIElement>(null);
  useEffect(() => {
    row.current?.scrollIntoView({ block: "center" });
  }, []);
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
    <li ref={row} className="ns-row editing">
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

type FillProps = { items: SendItem[]; added: string[]; onToggle: (key: string) => void; onNext: () => void };

/**
 * Every item on one page: "Find" opens it on nemlig.com, "In basket" ticks it. Items already in the basket sit at the bottom
 * when the step opens; rows ticked now stay put, and focus goes on to the next row's Find.
 */
function Fill({ items, added, onToggle, onNext }: FillProps) {
  const [opened, setOpened] = useState<string[]>([]);
  const [order] = useState(() => [...items.filter((item) => !added.includes(item.key)), ...items.filter((item) => added.includes(item.key))].map((item) => item.key));
  const [asking, setAsking] = useState(false);
  const list = useRef<HTMLUListElement>(null);
  const open = items.filter((item) => !added.includes(item.key));
  const done = items.filter((item) => added.includes(item.key));
  const guessing = open.some((item) => !item.pack && item.need);
  const shown = [...items].sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));

  const tick = (key: string) => {
    onToggle(key);
    if (added.includes(key)) return;
    const at = shown.findIndex((item) => item.key === key);
    const next = [...shown.slice(at + 1), ...shown.slice(0, at)].find((item) => !added.includes(item.key));
    const target = next
      ? list.current?.querySelector<HTMLElement>(`[data-key="${CSS.escape(next.key)}"] .ns-find`)
      : list.current?.closest("dialog")?.querySelector<HTMLElement>(".ns-foot .ns-primary");
    target?.focus();
  };

  return (
    <Body
      foot={
        asking ? (
          <div className="ns-ask" role="group" aria-labelledby="ns-ask-text">
            <p id="ns-ask-text">
              <strong>{t(open.length === 1 ? "1 item is not in the basket." : "{n} items are not in the basket.", { n: open.length })}</strong> {t("Carry on anyway?")}
            </p>
            <button type="button" className="btn white" autoFocus onClick={() => setAsking(false)}>
              {t("Keep adding")}
            </button>
            <button type="button" className="btn sun" onClick={onNext}>
              {t("Yes, carry on")}
            </button>
          </div>
        ) : (
          <Primary onClick={() => (open.length === 0 ? onNext() : setAsking(true))}>
            {open.length === 0 ? t("Next") : t("Next, {n} not added", { n: open.length })} <span aria-hidden="true">→</span>
          </Primary>
        )
      }
    >
      <div className="ns-progress" role="progressbar" aria-valuemin={0} aria-valuemax={items.length} aria-valuenow={done.length} aria-label={t("Progress")}>
        <span style={{ inlineSize: `${(done.length / Math.max(items.length, 1)) * 100}%` }} />
      </div>
      <p className="ns-lead">
        <strong>{t("{n} of {total} in your basket.", { n: done.length, total: items.length })}</strong> {t("Tap Find to open an item on nemlig.com, add it there, then tick it here.")}
      </p>
      {guessing && <p className="ns-note">{t("Without a pack size, take the smallest pack that covers what you need. Set a pack size on the shopping list and we count the packs for you.")}</p>}
      <ul className="ns-fill" ref={list}>
        {shown.map((item) => {
          const isDone = added.includes(item.key);
          const wasOpened = opened.includes(item.key);
          return (
            <li key={item.key} data-key={item.key} className={`ns-item${isDone ? " done" : ""}`}>
              <div className="ns-what">
                <strong>{item.name}</strong>
                <ItemFacts item={item} />
              </div>
              <div className="ns-item-tools">
                {!isDone && (
                  <button
                    type="button"
                    className={`btn small ns-find ${wasOpened ? "white" : "sun"}`}
                    aria-label={t("Find {name} on nemlig.com", { name: item.name })}
                    onClick={() => {
                      setOpened((before) => [...before, item.key]);
                      openNemlig(itemUrl(item));
                    }}
                  >
                    {t("Find")} <span aria-hidden="true">↗</span>
                  </button>
                )}
                <button type="button" className={`btn small ${isDone || wasOpened ? "mint" : "white"}`} aria-pressed={isDone} aria-label={t("{name} is in the basket", { name: item.name })} onClick={() => tick(item.key)}>
                  <span aria-hidden="true">✓</span> {t("In basket")}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="ns-note">{t("Your ticks are saved on this device.")}</p>
    </Body>
  );
}
