import { lazy, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";

// The service worker makes the app installable on the home screen and lets it open offline.
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch((error: Error) => console.error(`The service worker didn't register: ${error.message}`));
}

// A phone keeps the app open in the background for days. Coming back after half an hour or more, it checks for a
// newer version and reloads into it (the address keeps the screen you were on).
const scriptOf = (html: string) => /<script[^>]+src="([^"]+)"/.exec(html)?.[1];
const running = document.querySelector<HTMLScriptElement>("script[type=module][src]")?.getAttribute("src");
let hiddenAt = Date.now();
document.addEventListener("visibilitychange", async () => {
  if (document.hidden) return void (hiddenAt = Date.now());
  if (!running || Date.now() - hiddenAt < 30 * 60_000) return;
  try {
    const latest = scriptOf(await (await fetch("/", { cache: "no-cache" })).text());
    if (latest && latest !== running) window.location.reload();
  } catch {
    // Offline: keep the version we have.
  }
});

// /s/<token> is a share link. The server answers it with share.html, so this only runs under the Vite dev server.
const shareToken = /^\/s\/([^/]+)\/?$/.exec(window.location.pathname)?.[1];
const SharePage = lazy(() => import("./recipes/SharePage.tsx").then((module) => ({ default: module.SharePage })));

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {shareToken ? (
      <Suspense>
        <SharePage token={shareToken} />
      </Suspense>
    ) : (
      <App />
    )}
  </StrictMode>,
);
