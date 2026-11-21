import { useEffect, useRef, useState, type KeyboardEvent, type TouchEvent } from "react";
import { t } from "./i18n.ts";
import "./photo-viewer.css";

export type ViewerPhoto = { url: string; alt: string };

/**
 * One photo at a time over the whole screen, inside the app, so the home-screen app on iPhone (which has no browser
 * back) never lands on a bare image. ← Back, ✕ and Escape close it; swipe or the arrow keys move between photos.
 */
export function PhotoViewer({ photos, start, onClose }: { photos: ViewerPhoto[]; start: number; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [at, setAt] = useState(start);
  const swipeFrom = useRef<{ x: number; y: number }>(undefined);
  const photo = photos[at];
  const many = photos.length > 1;
  const move = (by: number) => setAt((current) => Math.min(Math.max(current + by, 0), photos.length - 1));

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
    const scroll = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = scroll;
    };
  }, []);

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === "ArrowLeft") move(-1);
    if (event.key === "ArrowRight") move(1);
  };

  const onTouchStart = (event: TouchEvent) => {
    const touch = event.touches[0];
    swipeFrom.current = touch && event.touches.length === 1 ? { x: touch.clientX, y: touch.clientY } : undefined;
  };
  const onTouchEnd = (event: TouchEvent) => {
    const from = swipeFrom.current;
    const touch = event.changedTouches[0];
    swipeFrom.current = undefined;
    if (!from || !touch) return;
    const dx = touch.clientX - from.x;
    if (Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(touch.clientY - from.y)) move(dx < 0 ? 1 : -1);
  };

  if (!photo) return null;
  return (
    <dialog ref={ref} className="photo-viewer" aria-label={t("Photo {n} of {total}", { n: at + 1, total: photos.length })} onClose={onClose} onKeyDown={onKeyDown}>
      <div className="viewer-top">
        <button type="button" className="viewer-back" onClick={onClose}>
          ← {t("Back")}
        </button>
        {many && (
          <span className="viewer-count" aria-live="polite">
            {at + 1} / {photos.length}
          </span>
        )}
        <button type="button" className="viewer-close" aria-label={t("Close")} onClick={onClose} autoFocus>
          ✕
        </button>
      </div>
      <div className="viewer-stage" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
        <img key={photo.url} src={photo.url} alt={photo.alt} />
      </div>
      {many && (
        <div className="viewer-turn">
          <button type="button" aria-label={t("Previous photo")} disabled={at === 0} onClick={() => move(-1)}>
            ←
          </button>
          <button type="button" aria-label={t("Next photo")} disabled={at === photos.length - 1} onClick={() => move(1)}>
            →
          </button>
        </div>
      )}
    </dialog>
  );
}
