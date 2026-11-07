import { useEffect, useState, type FormEvent } from "react";

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
        <main className="page">
          <p>Can't reach the server right now. Try again in a moment.</p>
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
    <main className="page login">
      <img className="logo" src="/icons/icon-192.png" alt="" width={96} height={96} />
      <h1>Food planner</h1>
      <form onSubmit={submit}>
        <label>
          Name
          <input name="username" autoComplete="username" autoCapitalize="none" required />
        </label>
        <label>
          Password
          <input name="password" type="password" autoComplete="current-password" required />
        </label>
        {problem && <p role="alert">{problem}</p>}
        <button type="submit" disabled={busy}>
          Log in
        </button>
      </form>
    </main>
  );
}

function HomeScreen({ me, onLoggedOut }: { me: Me; onLoggedOut: () => void }) {
  const logOut = async () => {
    await fetch("/api/logout", { method: "POST" });
    onLoggedOut();
  };

  return (
    <main className="page home">
      <header>
        <h1>Hi {capitalise(me.username)}</h1>
        <button type="button" className="quiet" onClick={logOut}>
          Log out
        </button>
      </header>
      <section className="empty">
        <p className="big">Nothing here yet.</p>
        <p>Recipes and your week plan will show up here soon.</p>
      </section>
    </main>
  );
}
