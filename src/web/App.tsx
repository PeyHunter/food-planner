import { useEffect, useState, type FormEvent } from "react";

type Me = { username: string };
type State = { kind: "loading" } | { kind: "logged-out" } | { kind: "logged-in"; me: Me } | { kind: "offline" };

const displayName = (username: string) => username.charAt(0).toUpperCase() + username.slice(1);

export function App() {
  const [state, setState] = useState<State>({ kind: "loading" });

  useEffect(() => {
    fetch("/api/me")
      .then(async (response) => {
        if (response.ok) setState({ kind: "logged-in", me: (await response.json()) as Me });
        else if (response.status === 401) setState({ kind: "logged-out" });
        else setState({ kind: "offline" });
      })
      .catch(() => setState({ kind: "offline" }));
  }, []);

  switch (state.kind) {
    case "loading":
      return null;
    case "offline":
      return (
        <main className="page">
          <p>Food Planner can't reach its server right now. Try again in a moment.</p>
        </main>
      );
    case "logged-out":
      return <LoginScreen onLoggedIn={(me) => setState({ kind: "logged-in", me })} />;
    case "logged-in":
      return <HomeScreen me={state.me} onLoggedOut={() => setState({ kind: "logged-out" })} />;
  }
}

function LoginScreen({ onLoggedIn }: { onLoggedIn: (me: Me) => void }) {
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(true);
    setError(undefined);
    try {
      const response = await fetch("/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: form.get("username"), password: form.get("password") }),
      });
      const body = (await response.json()) as Me & { error?: string };
      if (response.ok) onLoggedIn(body);
      else setError(body.error ?? "Something went wrong. Try again.");
    } catch {
      setError("Can't reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="page">
      <h1>Food Planner</h1>
      <form className="login" onSubmit={submit}>
        <label>
          Username
          <input name="username" autoComplete="username" autoCapitalize="none" autoCorrect="off" required />
        </label>
        <label>
          Password
          <input name="password" type="password" autoComplete="current-password" required />
        </label>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        <button type="submit" disabled={busy}>
          Log in
        </button>
      </form>
    </main>
  );
}

function HomeScreen({ me, onLoggedOut }: { me: Me; onLoggedOut: () => void }) {
  async function logOut() {
    await fetch("/api/logout", { method: "POST" });
    onLoggedOut();
  }

  return (
    <main className="page">
      <h1>Hi {displayName(me.username)}</h1>
      <p>Recipes and the week plan are coming soon.</p>
      <button type="button" onClick={logOut}>
        Log out
      </button>
    </main>
  );
}
