import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App.tsx";
import { SharePage } from "./recipes/SharePage.tsx";

// The service worker makes the app installable on the home screen and lets it open offline.
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch((error: Error) => console.error(`The service worker didn't register: ${error.message}`));
}

// /s/<token> is a share link: a public page that never asks for a login.
const shareToken = /^\/s\/([^/]+)\/?$/.exec(window.location.pathname)?.[1];

createRoot(document.getElementById("root")!).render(<StrictMode>{shareToken ? <SharePage token={shareToken} /> : <App />}</StrictMode>);
