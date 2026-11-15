import { useEffect, useRef, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { KidsScreen } from "./kids/KidsScreen.tsx";
import { KidsContext } from "./kitchen.ts";
import { RecipesScreen } from "./recipes/RecipesScreen.tsx";
import { ShoppingScreen } from "./shopping/ShoppingScreen.tsx";
import { WeekScreen } from "./week/WeekScreen.tsx";

type Me = { username: string; kitchen: { id: string; name: string; kids: boolean } | null };
type State = { kind: "loading" } | { kind: "logged-out" } | { kind: "logged-in"; me: Me } | { kind: "offline" };

const capitalise = (name: string) => name.charAt(0).toUpperCase() + name.slice(1);

export function App() {
  const [state, setState] = useState<State>({ kind: "loading" });

  const load = async () => {
    try {
      const response = await fetch("/api/me");
      if (response.status === 401) return setState({ kind: "logged-out" });
      if (!response.ok) return setState({ kind: "offline" });
      setState({ kind: "logged-in", me: (await response.json()) as Me });
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
          <p className="card">Can't reach the server right now. Try again in a moment.</p>
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
      setProblem(body.error ?? "That didn't work. Try again.");
    } catch {
      setProblem("Can't reach the server right now. Try again in a moment.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="app login">
      <img className="logo" src="/icons/icon-192.png" alt="" width={96} height={96} />
      <h1>Food planner</h1>
      <span className="sticker mint tilt-l">Dinner, sorted</span>
      <form className="card" onSubmit={submit}>
        <label>
          Name
          <input name="username" autoComplete="username" autoCapitalize="none" required />
        </label>
        <label>
          Password
          <input name="password" type="password" autoComplete="current-password" required />
        </label>
        {problem && <p role="alert">{problem}</p>}
        <button type="submit" className="btn" disabled={busy}>
          Log in
        </button>
      </form>
    </main>
  );
}

type Tab = { id: string; label: string; icon: string; colour: string; screen?: () => ReactNode; soon: string };

// Later PRs add a `screen` to a tab; until then it shows the "Coming soon" card.
const allTabs: Tab[] = [
  { id: "recipes", label: "Recipes", icon: "📖", colour: "var(--tomato-soft)", screen: () => <RecipesScreen />, soon: "Flip through your recipe book and add new dishes." },
  { id: "week", label: "Week", icon: "📅", colour: "var(--sun-soft)", screen: () => <WeekScreen />, soon: "Plan dinners for the week and check the rules." },
  { id: "shopping", label: "Shopping", icon: "🛒", colour: "var(--mint-soft)", screen: () => <ShoppingScreen />, soon: "One list with everything the week needs." },
  { id: "kids", label: "Runi & kids", icon: "🧒", colour: "var(--lilac-soft)", screen: () => <KidsScreen />, soon: "Runi Lee's own recipes and rules, by age." },
];

function HomeScreen({ me, onLoggedOut }: { me: Me; onLoggedOut: () => void }) {
  const kids = me.kitchen?.kids ?? true;
  const tabs = kids ? allTabs : allTabs.filter((tab) => tab.id !== "kids");
  // The hash picks the tab, so a reload or a link to #/recipes/... opens that tab.
  const tabOfHash = () => tabs.find((tab) => window.location.hash.startsWith(`#/${tab.id}`));
  const [current, setCurrent] = useState(() => tabOfHash() ?? tabs[1]!);
  useEffect(() => {
    const onChange = () => setCurrent((shown) => tabOfHash() ?? shown);
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  // The name menu closes on a tap elsewhere, Escape, or a tab change.
  const menu = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const close = (event: Event) => {
      const open = menu.current;
      if (!open?.open) return;
      if (event instanceof KeyboardEvent ? event.key === "Escape" : !open.contains(event.target as Node)) open.open = false;
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", close);
    };
  }, []);
  useEffect(() => {
    if (menu.current) menu.current.open = false;
  }, [current]);
  const logOut = async () => {
    await fetch("/api/logout", { method: "POST" });
    onLoggedOut();
  };

  return (
    <KidsContext.Provider value={kids}>
      <main className="app">
        <header className="top">
          <img className="logo" src="/icons/icon-192.png" alt="" width={48} height={48} />
          {/* Logging out is rare, so it hides behind your name. */}
          <details className="me" ref={menu}>
            <summary>
              <h1>Hi {capitalise(me.username)}</h1>
              <span className="caret" aria-hidden="true" />
            </summary>
            <button type="button" className="btn white small" onClick={logOut}>
              Log out
            </button>
          </details>
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
            {tab.label}
          </button>
        ))}
      </nav>
    </KidsContext.Provider>
  );
}

function ComingSoon({ tab }: { tab: Tab }) {
  return (
    <section className="card" style={{ "--c": tab.colour } as CSSProperties}>
      <span className="sticker white tilt-l">Coming soon</span>
      <h2>{tab.label}</h2>
      <p className="note">{tab.soon}</p>
      <p className="note">We're still building this part. Check back soon!</p>
    </section>
  );
}
