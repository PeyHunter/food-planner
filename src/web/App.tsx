import { useEffect, useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { RecipesScreen } from "./recipes/RecipesScreen.tsx";

type Me = { username: string; kitchen: { id: string; name: string } | null };
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
const tabs: Tab[] = [
  { id: "recipes", label: "Recipes", icon: "📖", colour: "var(--tomato-soft)", screen: () => <RecipesScreen />, soon: "Flip through your recipe book and add new dishes." },
  { id: "week", label: "Week", icon: "📅", colour: "var(--sun-soft)", soon: "Plan dinners for the week and check the rules." },
  { id: "shopping", label: "Shopping", icon: "🛒", colour: "var(--mint-soft)", soon: "One list with everything the week needs." },
  { id: "kids", label: "Runi & kids", icon: "🧒", colour: "var(--lilac-soft)", soon: "Runi Lee's own recipes and rules, by age." },
];

function HomeScreen({ me, onLoggedOut }: { me: Me; onLoggedOut: () => void }) {
  // A reload on #/recipes/... stays on that tab.
  const [current, setCurrent] = useState(() => tabs.find((tab) => window.location.hash.startsWith(`#/${tab.id}`)) ?? tabs[1]!);
  const logOut = async () => {
    await fetch("/api/logout", { method: "POST" });
    onLoggedOut();
  };

  return (
    <>
      <main className="app">
        <header className="top">
          <img className="logo" src="/icons/icon-192.png" alt="" width={48} height={48} />
          <h1>Hi {capitalise(me.username)}</h1>
          <button type="button" className="btn white small end" onClick={logOut}>
            Log out
          </button>
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
            onClick={() => setCurrent(tab)}
          >
            <span className="ic" aria-hidden="true">
              {tab.icon}
            </span>
            {tab.label}
          </button>
        ))}
      </nav>
    </>
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
