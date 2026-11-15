import { useEffect, useRef, useState, type FormEvent } from "react";
import type { KidDocument } from "../../shared/children.ts";
import { deleteKidDocument, getKidDocuments, uploadKidDocument } from "./api.ts";

const size = (bytes: number) => (bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} kB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`);
const icon = (type: KidDocument["fileType"]) => (type === "pdf" ? "📄" : "🖼️");

/** The official food plans and guidelines, kept as a reference: upload a PDF or a photo, open it, remove it. */
export function FoodPlans() {
  const [papers, setPapers] = useState<KidDocument[]>();
  const [problem, setProblem] = useState<string>();
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File>();
  const [title, setTitle] = useState("");
  const picker = useRef<HTMLInputElement>(null);

  const load = () => getKidDocuments().then(setPapers, (error: Error) => setProblem(error.message));
  useEffect(() => {
    void load();
  }, []);

  const upload = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!file) return;
    setBusy(true);
    setProblem(undefined);
    try {
      await uploadKidDocument(file, title);
      setFile(undefined);
      setTitle("");
      if (picker.current) picker.current.value = "";
      await load();
    } catch (error) {
      setProblem((error as Error).message);
    }
    setBusy(false);
  };

  const remove = async (paper: KidDocument) => {
    if (!window.confirm(`Remove "${paper.title}"?`)) return;
    try {
      await deleteKidDocument(paper.id);
      await load();
    } catch (error) {
      setProblem((error as Error).message);
    }
  };

  return (
    <section className="panel food-plans" aria-labelledby="food-plans-title">
      <h3 id="food-plans-title">Food plans and guidelines</h3>
      <p className="hint">Keep the official food plans here, like the ones from the health visitor, to look things up.</p>
      {papers && papers.length === 0 && <p className="hint">Nothing here yet.</p>}
      {papers && papers.length > 0 && (
        <ul className="papers">
          {papers.map((paper) => (
            <li key={paper.id}>
              <a href={paper.url} target="_blank" rel="noreferrer">
                <span aria-hidden="true">{icon(paper.fileType)}</span>
                <span>
                  <strong>{paper.title}</strong>
                  <small>
                    {paper.fileType.toUpperCase()}, {size(paper.bytes)}
                    {paper.by && `, added by ${paper.by.charAt(0).toUpperCase()}${paper.by.slice(1)}`}
                  </small>
                </span>
              </a>
              <button type="button" className="remove" aria-label={`Remove ${paper.title}`} onClick={() => void remove(paper)}>
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
      <form className="add-paper" onSubmit={upload}>
        <label className="btn small white file-button">
          {file ? "Pick another file" : "Pick a PDF or photo"}
          <input
            ref={picker}
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp"
            aria-label="Pick a PDF or photo"
            onChange={(event) => {
              const picked = event.target.files?.[0];
              setFile(picked);
              if (picked && !title) setTitle(picked.name.replace(/\.[a-z0-9]{2,5}$/i, ""));
            }}
          />
        </label>
        {file && (
          <>
            <label>
              Name
              <input value={title} maxLength={120} onChange={(event) => setTitle(event.target.value)} placeholder="Kostplan 6-12 måneder" />
            </label>
            <button type="submit" className="btn small" disabled={busy}>
              {busy ? "Uploading…" : "Upload"}
            </button>
          </>
        )}
      </form>
      {problem && <p role="alert">{problem}</p>}
    </section>
  );
}
