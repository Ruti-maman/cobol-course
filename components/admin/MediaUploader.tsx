"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { createUploadUrl, finishUpload } from "@/app/admin/actions";

type Item = { name: string; progress: number; state: "wait" | "up" | "done" | "error"; message?: string };

/** העלאת סרטונים ומטלות ישירות מהמחשב לאחסון הפרטי, עם סרגל התקדמות לכל קובץ. */
export function MediaUploader({ slug }: { slug: string }) {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);

  const patch = (i: number, next: Partial<Item>) => setItems((list) => list.map((it, k) => (k === i ? { ...it, ...next } : it)));

  function put(url: string, file: File, contentType: string, onProgress: (p: number) => void): Promise<boolean> {
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();
      xhr.open("PUT", url);
      xhr.setRequestHeader("Content-Type", contentType);
      xhr.setRequestHeader("x-upsert", "true");
      xhr.setRequestHeader("cache-control", "max-age=3600");
      xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(Math.round((e.loaded / e.total) * 100));
      xhr.onload = () => resolve(xhr.status >= 200 && xhr.status < 300);
      xhr.onerror = () => resolve(false);
      xhr.send(file);
    });
  }

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    const list = [...files];
    const start = items.length;
    setItems((prev) => [...prev, ...list.map((f) => ({ name: f.name, progress: 0, state: "wait" as const }))]);
    setBusy(true);
    for (const [k, file] of list.entries()) {
      const i = start + k;
      patch(i, { state: "up" });
      const ticket = await createUploadUrl(slug, file.name, file.size).catch(() => ({ error: "תקלה בחיבור לשרת. נסי שוב." }));
      if ("error" in ticket) {
        patch(i, { state: "error", message: ticket.error });
        continue;
      }
      const ok = await put(ticket.url, file, ticket.contentType, (p) => patch(i, { progress: p }));
      if (!ok) {
        patch(i, { state: "error", message: "ההעלאה נכשלה. בדקי את החיבור לאינטרנט ונסי שוב." });
        continue;
      }
      const done = await finishUpload(slug, file.name).catch(() => ({ error: "תקלה בחיבור לשרת. נסי שוב." }));
      patch(i, "error" in done ? { state: "error", message: done.error } : { state: "done", progress: 100 });
    }
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="adm-upload">
      <label className="adm-drop">
        <input
          type="file"
          multiple
          accept=".mp4,.pdf,.docx,.zip"
          disabled={busy}
          onChange={(e) => {
            void upload(e.target.files);
            e.target.value = "";
          }}
        />
        <b>{busy ? "מעלה…" : "בחרי קבצים להעלאה"}</b>
        <span>סרטון MP4, או מטלה ב-PDF / Word / ZIP · עד 50MB לקובץ · קובץ עם אותו שם מחליף את הקודם</span>
      </label>
      {items.length > 0 && (
        <ul className="adm-progress" aria-live="polite">
          {items.map((it, i) => (
            <li key={`${it.name}-${i}`} data-state={it.state}>
              <span className="name">{it.name}</span>
              <progress max={100} value={it.progress} aria-label={`התקדמות העלאה: ${it.name}`} />
              <span className="st">
                {it.state === "done" ? "✓ עלה" : it.state === "error" ? it.message : it.state === "up" ? `${it.progress}%` : "ממתין"}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
