import { useEffect, useState } from "react";
import type { Language, Profile, ProfileChange } from "../../shared/profile.ts";
import { addDays, mondayOf, weekdayName } from "../../shared/week.ts";
import { locale, t, switchLanguage } from "../i18n.ts";
import { today } from "../recipes/api.ts";
import { getProfile, saveProfile } from "./api.ts";
import "./profile.css";

const languageNames: Record<Language, string> = { en: "English", da: "Dansk" };
const weekDays = Array.from({ length: 7 }, (_, index) => addDays(mondayOf(today()), index));

/** #/profile: your language, and the kitchen's settings (children, nemlig.com delivery). */
export function ProfileScreen() {
  const [profile, setProfile] = useState<Profile>();
  const [problem, setProblem] = useState<string>();

  useEffect(() => {
    getProfile().then(setProfile, (error: Error) => setProblem(error.message));
  }, []);

  const save = async (change: ProfileChange) => {
    setProblem(undefined);
    // The switch moves at once; the server's answer follows.
    setProfile((shown) => shown && { ...shown, ...change, nemlig: { ...shown.nemlig, ...change.nemlig } } as Profile);
    try {
      const saved = await saveProfile(change);
      setProfile(saved);
      // Tabs and the kids tab change with the language and the kids setting, so the app starts over.
      if (switchLanguage(saved.language) || change.kids !== undefined) window.location.reload();
    } catch (error) {
      setProblem((error as Error).message);
    }
  };

  return (
    <section className="profile">
      <h2>{t("Profile")}</h2>
      {problem && <p role="alert">{problem}</p>}
      {profile && (
        <>
          <section className="card">
            <h3>{t("Language")}</h3>
            <div className="chips" role="group" aria-label={t("Language")}>
              {(Object.keys(languageNames) as Language[]).map((language) => (
                <button key={language} type="button" className="chip" aria-pressed={profile.language === language} onClick={() => void save({ language })}>
                  {languageNames[language]}
                </button>
              ))}
            </div>
            <p className="hint">{t("Only for you. The others in your kitchen pick their own.")}</p>
          </section>

          <section className="card">
            <h3>{t("Your kitchen")}</h3>
            <label className="toggle">
              <input type="checkbox" role="switch" checked={profile.kids} onChange={(event) => void save({ kids: event.target.checked })} />
              <span>{t("We have a baby or child")}</span>
            </label>
            <p className="hint">{t("Shows the kids tab, child meals and child rules. You can name the child on the kids tab.")}</p>
          </section>

          <section className="card">
            <h3>nemlig.com</h3>
            <label className="toggle">
              <input type="checkbox" role="switch" checked={profile.nemlig.on} onChange={(event) => void save({ nemlig: { on: event.target.checked } })} />
              <span>{t("Get our groceries from nemlig.com")}</span>
            </label>
            {profile.nemlig.on && (
              <>
                <label>
                  {t("Delivery day")}
                  <select value={profile.nemlig.day} onChange={(event) => void save({ nemlig: { day: Number(event.target.value) } })}>
                    {weekDays.map((date, index) => (
                      <option key={date} value={index}>
                        {weekdayName(date, locale())}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="toggle">
                  <input type="checkbox" role="switch" checked={profile.nemlig.organic} onChange={(event) => void save({ nemlig: { organic: event.target.checked } })} />
                  <span>{t("Everything organic")}</span>
                </label>
              </>
            )}
            <p className="hint">
              {t("The shopping list gets a nemlig.com list: each item opens nemlig's search, so you can put it in your basket. Sending the list to nemlig.com by itself every week comes later.")}
            </p>
          </section>
        </>
      )}
    </section>
  );
}
