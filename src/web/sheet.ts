import { useEffect, type RefObject } from "react";

/**
 * Opens a sheet and keeps it in the part of the screen you can see:
 * on a phone the keyboard covers the bottom, so the sheet moves up and gets shorter.
 */
export function useSheet(ref: RefObject<HTMLDialogElement | null>) {
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    const view = window.visualViewport;
    if (!view) return;
    const fit = () => {
      dialog.style.setProperty("--room", `${view.height}px`);
      dialog.style.setProperty("--keyboard", `${Math.max(0, window.innerHeight - view.height - view.offsetTop)}px`);
    };
    fit();
    view.addEventListener("resize", fit);
    view.addEventListener("scroll", fit);
    return () => {
      view.removeEventListener("resize", fit);
      view.removeEventListener("scroll", fit);
    };
  }, [ref]);
}
