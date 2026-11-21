import { useEffect, useState } from "react";
import type { Language, Profile, ProfileChange } from "../../shared/profile.ts";
import { t, switchLanguage } from "../i18n.ts";
import { getProfile, saveProfile } from "./api.ts";
import { NemligSettings } from "./NemligSettings.tsx";
import "./profile.css";

const languageNames: Record<Language, string> = { en: "English", da: "Dansk" };

/** #/profile: your language, the kitchen's settings (children, nemlig.com delivery), and logging out. */
export function ProfileScreen({ onBack, onLogOut }: { onBack: () => void; onLogOut: () => void }) {
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
      <button type="button" className="btn white small back" onClick={onBack}>
        <span aria-hidden="true">←</span> {t("Back")}
      </button>
      <h2>{t("Profile")}</h2>
      {problem && <p role="alert">{problem}</p>}
      {profile && (
        <>
          <section className="card">
            <h3>{t("Language")}</h3>
            {/* Native radios: one tap switches, arrow keys move, and screen readers say "1 of 2". */}
            <div className="segmented" role="radiogroup" aria-label={t("Language")}>
              {(Object.keys(languageNames) as Language[]).map((language) => (
                <label key={language}>
                  <input type="radio" name="language" value={language} checked={profile.language === language} onChange={() => void save({ language })} />
                  <span>{languageNames[language]}</span>
                </label>
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
              <NemligSettings
                day={profile.nemlig.day}
                organic={profile.nemlig.organic}
                onDay={(day) => void save({ nemlig: { day } })}
                onOrganic={(organic) => void save({ nemlig: { organic } })}
              />
            )}
            <p className="hint">{t("Shopping gets a “Send list to nemlig.com” button. It opens nemlig.com for each item, so you can put it in your basket there. You log in and pay on nemlig.com.")}</p>
          </section>
        </>
      )}
      <button type="button" className="btn white log-out" onClick={onLogOut}>
        {t("Log out")}
      </button>
    </section>
  );
}
