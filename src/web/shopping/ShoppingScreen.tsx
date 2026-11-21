import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { currentLanguage, locale, t } from "../i18n.ts";
import { shopSections, type ShopSection } from "../../shared/recipes.ts";
import { restOfWeek, type ShoppingItem, type ShoppingView } from "../../shared/shopping.ts";
import { formatAmount, units, type Unit } from "../../shared/units.ts";
import { addDays, mondayOf, weekDates } from "../../shared/week.ts";
import { saveIngredient, today } from "../recipes/api.ts";
import type { Profile } from "../../shared/profile.ts";
import { amountLabel } from "../../shared/nemlig.ts";
import { getProfile } from "../profile/api.ts";
import { addExtra, boughtAll, bringBack, clearTicked, getShopping, removeExtra, setTick } from "./api.ts";
import { hasSend, NemligSend } from "./NemligSend.tsx";
import "./shopping.css";

const pollMs = 3000;
const dayLetter = (date: string) => new Date(`${date}T00:00:00Z`).toLocaleDateString(locale(), { weekday: "short", timeZone: "UTC" });
const dayName = (date: string) => new Date(`${date}T00:00:00Z`).toLocaleDateString(locale(), { weekday: "long", timeZone: "UTC" });
const amountText = (amount: number, unit: Unit) => amountLabel(amount, unit, currentLanguage());

/** A tick the server may not have seen yet. `doneAt` is when the save finished. */
type Pending = { ticked: boolean; doneAt?: number };

export function ShoppingScreen() {
  const thisMonday = mondayOf(today());
  // A nemlig.com send left open next week brings you back to next week.
  const [monday, setMonday] = useState(() => (!hasSend(thisMonday) && hasSend(addDays(thisMonday, 7)) ? addDays(thisMonday, 7) : thisMonday));
  const [days, setDays] = useState(() => (monday === thisMonday ? restOfWeek(today()) : weekDates(monday)));
  const [view, setView] = useState<ShoppingView>();
  const [problem, setProblem] = useState<string>();
  const [editing, setEditing] = useState<string>();
  const pending = useRef(new Map<string, Pending>());
  const [, redraw] = useState(0);
  const latest = useRef(0);
  const [nemlig, setNemlig] = useState<Profile["nemlig"]>();
  const [sending, setSending] = useState(false);

  useEffect(() => {
    getProfile().then((profile) => setNemlig(profile.nemlig), () => setNemlig(undefined));
  }, []);
  // Opening the send again after a reload: it carries on where it was.
  useEffect(() => setSending(hasSend(monday)), [monday]);

  const load = useCallback(async () => {
    const request = ++latest.current;
    const started = performance.now();
    try {
      const next = await getShopping(monday, days);
      if (request !== latest.current) return;
      // A tick saved before this request started is in the answer; later ones still show from `pending`.
      for (const [key, tick] of pending.current) if (tick.doneAt !== undefined && tick.doneAt < started) pending.current.delete(key);
      setView(next);
      setProblem(undefined);
    } catch (error) {
      if (request === latest.current) setProblem((error as Error).message);
    }
  }, [monday, days]);

  useEffect(() => {
    void load();
    const timer = setInterval(() => document.visibilityState === "visible" && void load(), pollMs);
    return () => clearInterval(timer);
  }, [load]);

  const act = async (change: () => Promise<unknown>) => {
    try {
      await change();
    } catch (error) {
      setProblem((error as Error).message);
    }
    await load();
  };

  const tick = async (key: string, ticked: boolean) => {
    const mine: Pending = { ticked };
    pending.current.set(key, mine);
    redraw((n) => n + 1);
    try {
      await setTick(monday, key, ticked);
      mine.doneAt = performance.now();
    } catch (error) {
      if (pending.current.get(key) === mine) pending.current.delete(key);
      setProblem((error as Error).message);
      redraw((n) => n + 1);
    }
  };
  const isTicked = (key: string, fromServer: boolean) => pending.current.get(key)?.ticked ?? fromServer;

  const pickWeek = (next: string) => {
    setMonday(next);
    setDays(next === thisMonday ? restOfWeek(today()) : weekDates(next));
    setView(undefined);
    pending.current.clear();
  };
  const toggleDay = (date: string) => setDays((shown) => (shown.includes(date) ? shown.filter((day) => day !== date) : [...shown, date].sort()));

  const shown = view?.monday === monday ? view : undefined;
  const anyTicked = !!shown && (shown.sections.some((section) => section.lines.some((line) => isTicked(line.key, line.ticked))) || shown.extras.some((extra) => isTicked(extra.key, extra.ticked)));
  const empty = !!shown && shown.sections.length === 0 && shown.extras.length === 0;
  const leftToBuy = !!shown && (shown.sections.some((section) => section.lines.some((line) => !isTicked(line.key, line.ticked))) || shown.extras.some((extra) => !isTicked(extra.key, extra.ticked)));
  const allKeys = shown ? [...shown.sections.flatMap((section) => section.lines.map((line) => line.key)), ...shown.extras.map((extra) => extra.key)] : [];

  return (
    <section className="shopping">
      <div className="head">
        <h2>{t("Shopping")}</h2>
        <span className="sticker mint tilt-r">{shown ? t("{n} things", { n: shown.sections.reduce((sum, section) => sum + section.lines.length, 0) + shown.extras.length }) : "…"}</span>
      </div>
      <div className="chips" role="group" aria-label="Which week">
        <button type="button" className="chip" aria-pressed={monday === thisMonday} onClick={() => pickWeek(thisMonday)}>
          {t("This week")}
        </button>
        <button type="button" className="chip" aria-pressed={monday !== thisMonday} onClick={() => pickWeek(addDays(thisMonday, 7))}>
          {t("Next week")}
        </button>
      </div>
      <div className="day-chips" role="group" aria-label="Days to shop for">
        {weekDates(monday).map((date) => (
          <button key={date} type="button" className="day-chip" aria-pressed={days.includes(date)} aria-label={dayName(date)} onClick={() => toggleDay(date)}>
            {dayLetter(date)}
          </button>
        ))}
      </div>
      {problem && <p role="alert">{problem}</p>}
      {nemlig && leftToBuy && (
        <button type="button" className="btn sun send-nemlig" onClick={() => setSending(true)}>
          <span aria-hidden="true">🛒</span> {t("Send list to nemlig.com")} <span aria-hidden="true">→</span>
        </button>
      )}
      {sending && nemlig && shown && (
        <NemligSend
          monday={monday}
          view={shown}
          nemlig={nemlig}
          isTicked={isTicked}
          onNemlig={setNemlig}
          onTickOff={async (keys) => {
            await Promise.all(keys.map((key) => tick(key, true)));
          }}
          onClose={() => setSending(false)}
        />
      )}
      {empty && <p className="card note">{t("Nothing to buy for these days. Plan some dinners on the Week tab, or add something below.")}</p>}
      {shown?.sections.map(({ section, lines }) => {
        const ordered = [...lines].sort((a, b) => Number(isTicked(a.key, a.ticked)) - Number(isTicked(b.key, b.ticked)));
        return (
          <section key={section} className="aisle" aria-label={section}>
            <h3>{t(section)}</h3>
            <ul>
              {ordered.map((line) => (
                <Line
                  key={line.key}
                  line={line}
                  ticked={isTicked(line.key, line.ticked)}
                  onTick={(ticked) => tick(line.key, ticked)}
                  editing={editing === line.key}
                  onEdit={(open) => setEditing(open ? line.key : undefined)}
                  onSavePack={(packAmount, packUnit) =>
                    act(async () => {
                      const { shopSection, alwaysAtHome } = line.ingredient;
                      await saveIngredient(line.ingredient.id, { shopSection, alwaysAtHome, packAmount, packUnit });
                      setEditing(undefined);
                    })
                  }
                  onMove={(shopSection) =>
                    act(() => {
                      const { packAmount, packUnit, alwaysAtHome } = line.ingredient;
                      return saveIngredient(line.ingredient.id, { shopSection, packAmount, packUnit, alwaysAtHome });
                    })
                  }
                />
              ))}
            </ul>
          </section>
        );
      })}
      {shown && (
        <section className="aisle extras" aria-label="Extras">
          <h3>{t("Extras")}</h3>
          {shown.extras.length > 0 && (
            <ul>
              {[...shown.extras]
                .sort((a, b) => Number(isTicked(a.key, a.ticked)) - Number(isTicked(b.key, b.ticked)))
                .map((extra) => {
                  const ticked = isTicked(extra.key, extra.ticked);
                  return (
                    <li key={extra.key} className={ticked ? "item done" : "item"}>
                      <button type="button" role="checkbox" aria-checked={ticked} className="tick" onClick={() => tick(extra.key, !ticked)}>
                        <span className="box" aria-hidden="true">
                          {ticked ? "✓" : ""}
                        </span>
                        <span className="what">
                          <strong>{extra.name}</strong>
                        </span>
                      </button>
                      <button type="button" className="remove" aria-label={`Remove ${extra.name}`} onClick={() => act(() => removeExtra(monday, extra.id))}>
                        ×
                      </button>
                    </li>
                  );
                })}
            </ul>
          )}
          <AddExtra onAdd={(name) => act(() => addExtra(monday, name))} />
        </section>
      )}
      {shown && (allKeys.length > 0 || shown.cleared > 0) && (
        <div className="foot">
          {allKeys.length > 0 && (
            <button type="button" className="btn sun" onClick={() => act(() => boughtAll(monday, allKeys))}>
              {t("✓ Bought it all")}
            </button>
          )}
          {anyTicked && (
            <button type="button" className="btn mint" onClick={() => act(() => clearTicked(monday))}>
              {t("Clear ticked")}
            </button>
          )}
          {shown.cleared > 0 && (
            <p className="note">
              {t("{n} cleared.", { n: shown.cleared })}{" "}
              <button type="button" className="link" onClick={() => act(() => bringBack(monday))}>
                {t("Bring back")}
              </button>
            </p>
          )}
        </div>
      )}
    </section>
  );
}

function Line({
  line,
  ticked,
  onTick,
  editing,
  onEdit,
  onSavePack,
  onMove,
}: {
  line: ShoppingItem;
  ticked: boolean;
  onTick: (ticked: boolean) => void;
  editing: boolean;
  onEdit: (open: boolean) => void;
  onSavePack: (amount: number, unit: Unit) => void;
  onMove: (section: ShopSection) => void;
}) {
  const { ingredient } = line;
  const { packAmount, packUnit } = ingredient;
  const pack = line.packs !== null && packAmount !== null && packUnit !== null ? `${formatAmount(packAmount, packUnit)} ${t(packUnit)}` : null;
  const need = line.amount !== null && line.unit !== null ? amountText(line.amount, line.unit) : null;
  return (
    <li className={ticked ? "item done" : "item"}>
      <button type="button" role="checkbox" aria-checked={ticked} className="tick" onClick={() => onTick(!ticked)}>
        <span className="box" aria-hidden="true">
          {ticked ? "✓" : ""}
        </span>
        <span className="what">
          <strong>{ingredient.name}</strong>
          {pack && (
            <>
              <span className="buy">{t(line.packs === 1 ? "Buy 1 pack ({pack})" : "Buy {n} packs ({pack} each)", { n: line.packs ?? 0, pack })}</span>
              <span className="need">
                {t("You need {amount}", { amount: need ?? "" })}
                {line.spare && ` · ${t("{amount} left over", { amount: amountText(line.spare.amount, line.spare.unit) })}`}
              </span>
            </>
          )}
          <small>{line.meals.join(" · ")}</small>
        </span>
        {!pack && need && <span className="amount">{need}</span>}
      </button>
      {!editing && (
        <div className="line-tools">
          {line.needsPackSize && (
            <button type="button" className="link" onClick={() => onEdit(true)}>
              {t("Set pack size")}
            </button>
          )}
          <select className="move" aria-label={`Move ${ingredient.name} to another shop section`} value="" onChange={(event) => onMove(event.target.value as ShopSection)}>
            <option value="" disabled>
              {t("Move to…")}
            </option>
            {shopSections
              .filter((section) => section !== ingredient.shopSection)
              .map((section) => (
                <option key={section} value={section}>
                  {t(section)}
                </option>
              ))}
          </select>
        </div>
      )}
      {editing && <PackEditor name={ingredient.name} unit={line.unit ?? "g"} onSave={onSavePack} onCancel={() => onEdit(false)} />}
    </li>
  );
}

function PackEditor({ name, unit, onSave, onCancel }: { name: string; unit: Unit; onSave: (amount: number, unit: Unit) => void; onCancel: () => void }) {
  const [problem, setProblem] = useState<string>();
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const amount = Number(String(form.get("amount")).replace(",", "."));
    if (!Number.isFinite(amount) || amount <= 0) return setProblem(t("Write a number above 0."));
    onSave(amount, form.get("unit") as Unit);
  };
  return (
    <form className="pack" aria-label={`Pack size for ${name}`} onSubmit={submit}>
      <label>
        {t("Pack size")}
        <input name="amount" inputMode="decimal" autoFocus placeholder="1" />
      </label>
      <label>
        {t("Unit")}
        <select name="unit" defaultValue={unit}>
          {units.map((one) => (
            <option key={one} value={one}>
              {t(one)}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" className="btn small mint">
        {t("Save")}
      </button>
      <button type="button" className="btn small white" onClick={onCancel}>
        {t("Cancel")}
      </button>
      {problem && <p role="alert">{problem}</p>}
    </form>
  );
}

function AddExtra({ onAdd }: { onAdd: (name: string) => Promise<void> }) {
  const [name, setName] = useState("");
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = name.trim();
    if (!text) return;
    setName("");
    await onAdd(text);
  };
  return (
    <form className="add" onSubmit={submit}>
      <input aria-label="Add something" placeholder={t("Add something, like milk")} value={name} onChange={(event) => setName(event.target.value)} maxLength={80} />
      <button type="submit" className="btn small mint">
        {t("Add")}
      </button>
    </form>
  );
}
