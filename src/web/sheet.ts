import { useEffect, type RefObject } from "react";

/**
 * Opens a sheet and keeps it in the part of the screen you can see:
 * on a phone the keyboard covers the bottom, so the sheet moves up and gets shorter.
 * The page behind is pinned while the sheet is open and comes back where it was.
 */
export function useSheet(ref: RefObject<HTMLDialogElement | null>) {
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    // Safari draws a focus ring round the first button showModal focuses; start on the sheet itself.
    dialog.focus({ preventScroll: true });
    // iOS Safari still scrolls a page with overflow:hidden to bring a focused field into view; a fixed body has nothing to scroll.
    const y = window.scrollY;
    const body = document.body.style;
    Object.assign(body, { position: "fixed", insetInline: "0", top: `${-y}px` });
    const view = window.visualViewport;
    const fit = () => {
      if (!view) return;
      dialog.style.setProperty("--room", `${view.height}px`);
      dialog.style.setProperty("--keyboard", `${Math.max(0, window.innerHeight - view.height - view.offsetTop)}px`);
    };
    fit();
    view?.addEventListener("resize", fit);
    view?.addEventListener("scroll", fit);
    return () => {
      view?.removeEventListener("resize", fit);
      view?.removeEventListener("scroll", fit);
      Object.assign(body, { position: "", insetInline: "", top: "" });
      window.scrollTo(0, y);
    };
  }, [ref]);
}
