import { useId } from "react";
import { organicChoices, type Organic } from "../../shared/profile.ts";
import { addDays, mondayOf, weekdayName } from "../../shared/week.ts";
import { locale, t } from "../i18n.ts";
import { today } from "../recipes/api.ts";
import "./nemlig-settings.css";

const organicLabel: Record<Organic, string> = { none: "None", produce: "Fruit & veg", all: "Everything" };
const shortDay = (date: string) => new Date(`${date}T00:00:00Z`).toLocaleDateString(locale(), { weekday: "short", timeZone: "UTC" }).replace(".", "");

/** Delivery day as seven day chips, and how much should be organic. Used on Profile and in the nemlig.com setup. */
export function NemligSettings({ day, organic, onDay, onOrganic }: { day: number; organic: Organic; onDay: (day: number) => void; onOrganic: (organic: Organic) => void }) {
  const monday = mondayOf(today());
  const id = useId();
  return (
    <div className="nemlig-settings">
      <fieldset>
        <legend>{t("Delivery day")}</legend>
        <div className="nemlig-days">
          {Array.from({ length: 7 }, (_, index) => {
            const date = addDays(monday, index);
            return (
              <label key={index} title={weekdayName(date, locale())}>
                <input type="radio" name={`${id}-day`} value={index} checked={day === index} onChange={() => onDay(index)} aria-label={weekdayName(date, locale())} />
                <span aria-hidden="true">{shortDay(date)}</span>
              </label>
            );
          })}
        </div>
      </fieldset>
      <fieldset>
        <legend>{t("Organic")}</legend>
        <div className="nemlig-organic">
          {organicChoices.map((choice) => (
            <label key={choice}>
              <input type="radio" name={`${id}-organic`} value={choice} checked={organic === choice} onChange={() => onOrganic(choice)} />
              <span>{t(organicLabel[choice])}</span>
            </label>
          ))}
        </div>
        <p className="hint">{t("Organic items get “økologisk” in the nemlig.com search.")}</p>
      </fieldset>
    </div>
  );
}
