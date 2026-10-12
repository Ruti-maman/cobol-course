import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { getLessonAccess } from "@/lib/access-server";
import { mayStreamVideo } from "@/lib/app-client";
import { getPublishedLesson } from "@/lib/course";
import { resolveMediaFile } from "@/lib/media-storage";

// הגשת קובצי שיעור (סרטונים ומטלות). זהה במחשב ובאתר החי — ראו lib/media-storage.ts.
// כל קובץ מוגש רק אחרי התחברות + זכאות לשיעור הספציפי (CLAUDE.md סעיף 6.1).

const contentTypes: Record<string, string> = {
  ".mp4": "video/mp4",
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".zip": "application/zip",
};

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/** זרם קריאה מהקובץ שנסגר בשקט כשהנגן מבטל בקשה (למשל בדילוג בתוך הסרטון). */
function fileStream(fullPath: string, start?: number, end?: number): ReadableStream<Uint8Array> {
  const nodeStream = createReadStream(fullPath, { start, end });
  let closed = false;
  return new ReadableStream<Uint8Array>({
    start(controller) {
      nodeStream.on("data", (chunk) => {
        if (closed) return;
        controller.enqueue(typeof chunk === "string" ? new TextEncoder().encode(chunk) : new Uint8Array(chunk));
        if ((controller.desiredSize ?? 1) <= 0) nodeStream.pause();
      });
      nodeStream.on("end", () => {
        if (!closed) {
          closed = true;
          controller.close();
        }
      });
      nodeStream.on("error", (err) => {
        if (!closed) {
          closed = true;
          controller.error(err);
        }
      });
    },
    pull() {
      nodeStream.resume();
    },
    cancel() {
      closed = true;
      nodeStream.destroy();
    },
  });
}

function notFound() {
  return new Response("Not found", { status: 404 });
}

export async function GET(request: Request, ctx: RouteContext<"/api/media/[slug]/[file]">) {
  const { slug, file } = await ctx.params;
  const lesson = getPublishedLesson(slug);
  if (!lesson) return notFound();

  const access = await getLessonAccess(lesson.slug);
  if (access === "login") return new Response("Login required", { status: 401 });
  if (access !== "ok") return new Response("Forbidden", { status: 403 });

  const fullPath = (await resolveMediaFile(lesson, file)) ?? (await resolveMediaFile(lesson, safeDecode(file)));
  if (!fullPath) return notFound();

  const ext = path.extname(fullPath).toLowerCase();
  // סרטונים — רק לאפליקציית הצפייה. מטלות אפשר להוריד גם מהדפדפן.
  if (ext === ".mp4" && !mayStreamVideo(request.headers.get("user-agent"))) {
    return new Response("Videos are available in the course app only", { status: 403 });
  }
  const size = (await stat(fullPath)).size;
  const headers = new Headers({
    "Content-Type": contentTypes[ext] ?? "application/octet-stream",
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, no-store",
  });

  if (ext !== ".mp4") {
    // ?view=1 — להצגה בתוך הדף (צפייה במשימה בלי להוריד); אחרת — הורדה.
    const disposition = new URL(request.url).searchParams.get("view") === "1" ? "inline" : "attachment";
    headers.set("Content-Disposition", `${disposition}; filename*=UTF-8''${encodeURIComponent(path.basename(fullPath))}`);
  }

  // תמיכה ב-Range כדי שאפשר יהיה לדלג בתוך הסרטון.
  const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get("range") ?? "");
  if (range) {
    const start = range[1] ? Number(range[1]) : 0;
    const end = range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    if (start > end || start >= size) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    }
    headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
    headers.set("Content-Length", String(end - start + 1));
    return new Response(fileStream(fullPath, start, end), { status: 206, headers });
  }

  headers.set("Content-Length", String(size));
  return new Response(fileStream(fullPath), { status: 200, headers });
}
