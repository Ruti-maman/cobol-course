"use client";

import { useEffect, useRef, useState } from "react";

export type AssignmentFile = { format: string; src: string };
/** final — פרויקט הסיום של הקורס: מוצג בכרטיס מיוחד */
export type Assignment = { title: string; files: AssignmentFile[]; final?: boolean };

/** PDF קודם — הדפדפן מציג אותו בדיוק כמו המקור. */
function preferredIndex(files: AssignmentFile[]): number {
  const pdf = files.findIndex((f) => f.format === "PDF");
  return pdf >= 0 ? pdf : 0;
}

/** חלון צפייה במשימה — בלי להוריד. כפתור הורדה זמין למי שרוצה. */
export function AssignmentViewer({ assignment, onClose }: { assignment: Assignment | null; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  // null = עדיין לא נבחר פורמט → מוצג המועדף (PDF)
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (assignment) {
      if (document.fullscreenElement) void document.exitFullscreen();
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [assignment]);

  const files = assignment?.files ?? [];
  const file = files[active ?? preferredIndex(files)];

  return (
    <dialog
      ref={dialogRef}
      className="viewer"
      aria-label={assignment ? `צפייה במשימה: ${assignment.title}` : undefined}
      onClose={onClose}
      onClick={(e) => {
        // לחיצה על הרקע הכהה מסביב סוגרת
        if (e.target === e.currentTarget) onClose();
      }}
    >
      {assignment && file && (
        <div className="viewer-in">
          <header className="viewer-bar">
            <h2>{assignment.title}</h2>
            {files.length > 1 && (
              <div className="viewer-tabs" role="tablist" aria-label="פורמט">
                {files.map((f, i) => (
                  <button
                    key={f.src}
                    type="button"
                    role="tab"
                    aria-selected={f === file}
                    className="ltr"
                    onClick={() => setActive(i)}
                  >
                    {f.format}
                  </button>
                ))}
              </div>
            )}
            <a className="btn btn-1 viewer-dl" href={file.src} download>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
              </svg>
              הורדה
            </a>
            <button type="button" className="viewer-close" onClick={onClose} aria-label="סגירה">
              ✕
            </button>
          </header>
          <div className="viewer-body">
            {file.format === "PDF" ? (
              <iframe key={file.src} src={`${file.src}?view=1#toolbar=0&navpanes=0&view=FitH`} title={assignment.title} />
            ) : file.format === "DOCX" ? (
              <DocxView key={file.src} src={file.src} />
            ) : (
              <p className="viewer-msg">אי אפשר להציג את הקובץ הזה בדפדפן — אפשר להוריד אותו.</p>
            )}
          </div>
        </div>
      )}
    </dialog>
  );
}

/** הצגת קובץ Word בתוך הדף (ספריית docx-preview, נטענת רק כשצריך). */
function DocxView({ src }: { src: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [{ renderAsync }, res] = await Promise.all([import("docx-preview"), fetch(src)]);
        if (!res.ok) throw new Error(String(res.status));
        const blob = await res.blob();
        if (cancelled || !ref.current) return;
        ref.current.innerHTML = "";
        // במסך צר — בלי רוחב עמוד קבוע, כך שהטקסט זורם לרוחב המסך ונשאר בגודל קריא.
        const narrow = window.innerWidth < 700;
        ref.current.classList.toggle("fluid", narrow);
        await renderAsync(blob, ref.current, undefined, {
          inWrapper: true,
          breakPages: !narrow,
          ignoreWidth: narrow,
          ignoreHeight: narrow,
          ignoreLastRenderedPageBreak: true,
        });
        if (!cancelled) setState("ready");
      } catch {
        if (!cancelled) setState("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [src]);

  // מקטין את עמוד ה-Word כך שייכנס לרוחב החלון (גם בטלפון), בלי להגדיל מעבר לגודל אמיתי.
  useEffect(() => {
    const host = ref.current;
    const box = host?.parentElement;
    if (!host || !box || state !== "ready" || host.classList.contains("fluid")) return;
    const fit = () => {
      const page = host.querySelector<HTMLElement>("section.docx");
      if (!page) return;
      const zoom = Math.min(0.9, (box.clientWidth - 24) / (page.offsetWidth + 32));
      host.style.setProperty("--docx-zoom", String(Math.max(0.35, zoom)));
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(box);
    return () => ro.disconnect();
  }, [state]);

  return (
    <>
      {state === "loading" && <p className="viewer-msg">טוען את המשימה…</p>}
      {state === "error" && <p className="viewer-msg">לא הצלחנו להציג את הקובץ. אפשר להוריד אותו בכפתור למעלה.</p>}
      <div ref={ref} className="docx-host" hidden={state !== "ready"} />
    </>
  );
}
