import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import type { Language } from "../shared/profile.ts";
import { switchLanguage, t } from "./i18n.ts";
import { HomeTab } from "./home/HomeTab.tsx";
import { getChildren } from "./kids/api.ts";
import { kidsTabLabel } from "./kids/labels.ts";
import { KidsScreen } from "./kids/KidsScreen.tsx";
import { ProfileScreen } from "./profile/ProfileScreen.tsx";
import { cancelled, logInWithPasskey, passkeysWork } from "./security/api.ts";
import "./security/security.css";
import { KidNamesContext, KidsContext } from "./kitchen.ts";
import { RecipesScreen } from "./recipes/RecipesScreen.tsx";
import { ShoppingScreen } from "./shopping/ShoppingScreen.tsx";
import { WeekScreen } from "./week/WeekScreen.tsx";

type Me = { username: string; displayName: string | null; language: Language; kitchen: { id: string; name: string; kids: boolean; nemligOn: boolean } | null };
type State = { kind: "loading" } | { kind: "logged-out" } | { kind: "logged-in"; me: Me } | { kind: "offline" };

const capitalise = (name: string) => name.charAt(0).toUpperCase() + name.slice(1);

export function App() {
  const [state, setState] = useState<State>({ kind: "loading" });

  const load = async () => {
    try {
      const response = await fetch("/api/me");
      if (response.status === 401) return setState({ kind: "logged-out" });
      if (!response.ok) return setState({ kind: "offline" });
      const me = (await response.json()) as Me;
      // Text made when the app starts is in the old language, so start over in the new one.
      if (switchLanguage(me.language)) return window.location.reload();
      setState({ kind: "logged-in", me });
    } catch {
      setState({ kind: "offline" });
    }
  };

  useEffect(() => {
    void load();
  }, []);

  switch (state.kind) {
    case "loading":
      return null;
    case "offline":
      return (
        <main className="app">
          <p className="card">{t("Can't reach the server right now. Try again in a moment.")}</p>
        </main>
      );
    case "logged-out":
      return <LoginScreen onLoggedIn={load} />;
    case "logged-in":
      return (
        <HomeScreen
          me={state.me}
          onLoggedOut={() => setState({ kind: "logged-out" })}
        />
      );
  }
}

function LoginScreen({ onLoggedIn }: { onLoggedIn: () => Promise<void> }) {
  const [problem, setProblem] = useState<string>();
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setProblem(undefined);
    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: form.get("username"), password: form.get("password") }),
      });
      if (response.ok) return await onLoggedIn();
      const body = (await response.json().catch(() => ({}))) as { error?: string };
      setProblem(t(body.error ?? "That didn't work. Try again."));
    } catch {
      setProblem(t("Can't reach the server right now. Try again in a moment."));
    } finally {
      setBusy(false);
    }
  };

  const withPasskey = async () => {
    setBusy(true);
    setProblem(undefined);
    try {
      await logInWithPasskey();
      await onLoggedIn();
    } catch (error) {
      if (!cancelled(error)) setProblem((error as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="app login">
      <img className="logo" src="/icons/icon-192.png" alt="" width={96} height={96} />
      <h1>{t("Food planner")}</h1>
      <span className="sticker mint tilt-l">{t("Dinner, sorted")}</span>
      <form className="card" onSubmit={submit}>
        <label>
          {t("Name")}
          <input name="username" autoComplete="username" autoCapitalize="none" required />
        </label>
        <label>
          {t("Password")}
          <input name="password" type="password" autoComplete="current-password" required />
        </label>
        {problem && <p role="alert">{problem}</p>}
        <button type="submit" className="btn" disabled={busy}>
          {t("Log in")}
        </button>
        {passkeysWork() && (
          <>
            <p className="or">{t("or")}</p>
            <button type="button" className="btn mint passkey" disabled={busy} onClick={() => void withPasskey()}>
              {t("Use Face ID / fingerprint")}
            </button>
          </>
        )}
      </form>
    </main>
  );
}

type Tab = { id: string; label: string; icon: string; colour: string; screen?: () => ReactNode; soon: string };

// Later PRs add a `screen` to a tab; until then it shows the "Coming soon" card.
const allTabs: Tab[] = [
  { id: "home", label: "Home", icon: "🏠", colour: "var(--sun-soft)", screen: () => <HomeTab />, soon: "" },
  { id: "recipes", label: "Recipes", icon: "📖", colour: "var(--tomato-soft)", screen: () => <RecipesScreen />, soon: "Flip through your recipe book and add new dishes." },
  { id: "week", label: "Week", icon: "📅", colour: "var(--sun-soft)", screen: () => <WeekScreen />, soon: "Plan dinners for the week and check the rules." },
  { id: "shopping", label: "Shopping", icon: "🛒", colour: "var(--mint-soft)", screen: () => <ShoppingScreen />, soon: "One list with everything the week needs." },
  { id: "kids", label: "Kids", icon: "🧒", colour: "var(--lilac-soft)", screen: () => <KidsScreen />, soon: "Each child's own recipes and rules, by age." },
];

function HomeScreen({ me, onLoggedOut }: { me: Me; onLoggedOut: () => void }) {
  const kids = me.kitchen?.kids ?? true;
  const kidNames = useKidNames(kids);
  const label = (tab: Tab) => (tab.id === "kids" ? kidsTabLabel(kidNames) : t(tab.label));
  const tabs = kids ? allTabs : allTabs.filter((tab) => tab.id !== "kids");
  const profileTab: Tab = {
    id: "profile",
    label: "Profile",
    icon: "⚙",
    colour: "var(--paper)",
    screen: () => <ProfileScreen onBack={() => (window.location.hash = `#/${lastTab.current.id}`)} onLogOut={logOut} />,
    soon: "",
  };
  // The hash picks the tab, so a reload or a link to #/recipes/... opens that tab.
  const tabOfHash = () => [...tabs, profileTab].find((tab) => window.location.hash.startsWith(`#/${tab.id}`));
  const [current, setCurrent] = useState(() => tabOfHash() ?? tabs[0]!);
  useEffect(() => {
    const onChange = () => setCurrent((shown) => tabOfHash() ?? shown);
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  // Back from Profile goes to the tab you came from; Home when Profile was opened directly.
  const lastTab = useRef(current.id === "profile" ? tabs.find((tab) => tab.id === "home")! : current);
  if (current.id !== "profile") lastTab.current = current;
  const logOut = async () => {
    await fetch("/api/logout", { method: "POST" });
    // The next person to log in starts on Home, not on this person's last page. A link opened while logged out still works.
    window.history.replaceState(null, "", "#/home");
    onLoggedOut();
  };
  const name = me.displayName ?? capitalise(me.username);
  const onProfile = current.id === "profile";

  return (
    <KidsContext.Provider value={kids}>
      <KidNamesContext.Provider value={kidNames}>
      <main className="app">
        <header className="top">
          <a className="home" href="#/home">
            <img className="logo" src="/icons/icon-192.png" alt="" width={48} height={48} />
            <h1>{t("Hi {name}", { name })}</h1>
          </a>
          <a className="profile-link" href="#/profile" aria-label={t("Profile")} aria-current={onProfile ? "page" : undefined}>
            <span className="avatar" aria-hidden="true">
              {name.charAt(0)}
            </span>
            <span className="word" aria-hidden="true">
              {t("Profile")}
            </span>
          </a>
        </header>
        {current.screen ? current.screen() : <ComingSoon tab={current} />}
      </main>
      <nav className="tabbar" aria-label="Main">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className="tab"
            aria-current={tab.id === current.id ? "page" : undefined}
            onClick={() => {
              setCurrent(tab);
              window.location.hash = `#/${tab.id}`;
            }}
          >
            <span className="ic" aria-hidden="true">
              {tab.icon}
            </span>
            {label(tab)}
          </button>
        ))}
      </nav>
      </KidNamesContext.Provider>
    </KidsContext.Provider>
  );
}

/** The kids tab is named after the kitchen's children, so it needs their names. */
function useKidNames(kids: boolean) {
  const [names, setNames] = useState<string[]>([]);
  useEffect(() => {
    if (!kids) return;
    getChildren().then(
      (children) => setNames(children.map((child) => child.name)),
      () => setNames([]),
    );
  }, [kids]);
  return names;
}

function ComingSoon({ tab }: { tab: Tab }) {
  return (
    <section className="card" style={{ "--c": tab.colour } as CSSProperties}>
      <span className="sticker white tilt-l">{t("Coming soon")}</span>
      <h2>{t(tab.label)}</h2>
      <p className="note">{t(tab.soon)}</p>
      <p className="note">{t("We're still building this part. Check back soon!")}</p>
    </section>
  );
}
