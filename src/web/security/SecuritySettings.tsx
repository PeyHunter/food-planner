import { useEffect, useState } from "react";
import type { Activity, Device, Passkey } from "../../shared/security.ts";
import { locale, t } from "../i18n.ts";
import { addPasskey, cancelled, listActivity, listDevices, listPasskeys, logOutDevice, logOutOthers, passkeysWork, removePasskey } from "./api.ts";
import { useStepUp } from "./StepUp.tsx";
import "./security.css";

const when = (iso: string) => new Date(iso).toLocaleString(locale(), { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** Profile: passkeys, the devices you're logged in on, and what happened to your login lately. */
export function SecuritySettings() {
  const [passkeys, setPasskeys] = useState<Passkey[]>();
  const [devices, setDevices] = useState<Device[]>();
  const [activity, setActivity] = useState<Activity[]>();
  const [problem, setProblem] = useState<string>();
  const [busy, setBusy] = useState(false);
  const { guard, sheet } = useStepUp();

  const reload = () =>
    Promise.all([listPasskeys(), listDevices(), listActivity()]).then(
      ([keys, list, log]) => {
        setPasskeys(keys);
        setDevices(list);
        setActivity(log);
      },
      (error: Error) => setProblem(error.message),
    );
  useEffect(() => {
    void reload();
  }, []);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setProblem(undefined);
    try {
      await guard(action);
      await reload();
    } catch (error) {
      if (!cancelled(error)) setProblem((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const others = devices?.filter((device) => !device.current) ?? [];

  return (
    <>
      {problem && <p role="alert">{problem}</p>}
      <section className="card security" aria-labelledby="passkeys-title">
        <h3 id="passkeys-title">{t("Passkeys")}</h3>
        <p className="hint">{t("Log in with Face ID or your fingerprint instead of typing a password. Your password still works.")}</p>
        {passkeys && passkeys.length > 0 && (
          <ul className="rows">
            {passkeys.map((passkey) => (
              <li key={passkey.id}>
                <span>
                  <strong>{passkey.name}</strong>
                  <small>{t("Added {date}", { date: when(passkey.createdAt) })}</small>
                </span>
                <button type="button" className="btn small white" disabled={busy} aria-label={t("Remove passkey {name}", { name: passkey.name })} onClick={() => void run(() => removePasskey(passkey.id))}>
                  {t("Remove")}
                </button>
              </li>
            ))}
          </ul>
        )}
        {passkeysWork() ? (
          <button type="button" className="btn mint" disabled={busy} onClick={() => void run(addPasskey)}>
            {t("Use Face ID / fingerprint to log in")}
          </button>
        ) : (
          <p className="hint">{t("This browser can't use passkeys.")}</p>
        )}
      </section>

      <section className="card security" aria-labelledby="devices-title">
        <h3 id="devices-title">{t("Devices")}</h3>
        <ul className="rows">
          {devices?.map((device) => (
            <li key={device.id}>
              <span>
                <strong>
                  {device.browser}
                  {device.current && <span className="sticker mint">{t("This device")}</span>}
                </strong>
                <small>{t("Logged in {date} · last used {used}", { date: when(device.createdAt), used: when(device.lastUsedAt) })}</small>
              </span>
              {!device.current && (
                <button type="button" className="btn small white" disabled={busy} aria-label={t("Log out {browser}", { browser: device.browser })} onClick={() => void run(() => logOutDevice(device.id))}>
                  {t("Log out")}
                </button>
              )}
            </li>
          ))}
        </ul>
        {others.length > 0 && (
          <button type="button" className="btn white" disabled={busy} onClick={() => void run(logOutOthers)}>
            {t("Log out everywhere else")}
          </button>
        )}
      </section>

      <section className="card security" aria-labelledby="activity-title">
        <h3 id="activity-title">{t("Activity")}</h3>
        {activity?.length === 0 && <p className="hint">{t("Nothing yet.")}</p>}
        <ul className="rows activity">
          {activity?.map((entry, index) => (
            <li key={index}>
              <span>
                <strong>{t(entry.action)}</strong>
                <small>{[entry.detail && t(entry.detail), when(entry.at)].filter(Boolean).join(" · ")}</small>
              </span>
            </li>
          ))}
        </ul>
      </section>
      {sheet}
    </>
  );
}
