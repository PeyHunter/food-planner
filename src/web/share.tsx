import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { currentLanguage, switchLanguage } from "./i18n.ts";
import { SharePage } from "./recipes/SharePage.tsx";

const token = /^\/s\/([^/]+)\/?$/.exec(window.location.pathname)?.[1] ?? "";

// The share link doesn't say the owner's language, so the page follows the viewer: the language they picked in the
// app on this phone, or else their browser's. A browser-picked language is not remembered for the app.
const picked = (() => {
  try {
    return localStorage.getItem("language");
  } catch {
    return null;
  }
})();
const browser = navigator.languages.find((tag) => /^(da|en)\b/i.test(tag));
if (!picked && browser && /^da/i.test(browser)) {
  switchLanguage("da");
  try {
    localStorage.removeItem("language");
  } catch {
    // Nothing was stored.
  }
}
document.documentElement.lang = currentLanguage();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SharePage token={token} />
  </StrictMode>,
);
