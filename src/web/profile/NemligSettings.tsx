import { useId } from "react";
import { organicChoices, type Organic } from "../../shared/profile.ts";
import { t } from "../i18n.ts";
import "./nemlig-settings.css";

const organicLabel: Record<Organic, string> = { none: "None", produce: "Fruit & veg", all: "Everything" };

/** How much should be organic. Used on Profile and in the nemlig.com setup. */
export function NemligSettings({ organic, onOrganic }: { organic: Organic; onOrganic: (organic: Organic) => void }) {
  const id = useId();
  return (
    <div className="nemlig-settings">
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
