import { lazy, StrictMode, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";

// The service worker makes the app installable on the home screen and lets it open offline.
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch((error: Error) => console.error(`The service worker didn't register: ${error.message}`));
}

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
