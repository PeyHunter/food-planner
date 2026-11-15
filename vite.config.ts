import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  root: "src/web",
  plugins: [react()],
  build: {
    outDir: "../../dist/web",
    emptyOutDir: true,
    // share.html is the public /s/<token> page: its own small entry, so a visitor doesn't download the whole app.
    rolldownOptions: { input: { index: "src/web/index.html", share: "src/web/share.html" } },
  },
  server: { proxy: { "/api": "http://localhost:3000" } },
});
