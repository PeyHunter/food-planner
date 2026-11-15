import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { SharePage } from "./recipes/SharePage.tsx";

const token = /^\/s\/([^/]+)\/?$/.exec(window.location.pathname)?.[1] ?? "";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SharePage token={token} />
  </StrictMode>,
);
