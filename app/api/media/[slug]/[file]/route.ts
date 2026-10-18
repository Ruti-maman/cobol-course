import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { getLessonAccess } from "@/lib/access-server";
import { mayStreamVideo } from "@/lib/app-client";
import { isAdminRequest } from "@/lib/admin-server";
import type { Lesson } from "@/lib/course";
import { loadLessonForViewer } from "@/lib/lessons-store";
import { mediaSource, readStoredFile, resolveMediaFile, signedMediaUrl } from "@/lib/media-storage";
import { isPublicVideoWindow } from "@/lib/public-video";
import { clampVideoRange } from "@/lib/video-range";

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

/**
 * סרטונים מוגשים מכתובת האתר עצמו, בחתיכות: כל בקשת Range מקבלת עד CHUNK בתים.
 * כך אין לנגן קישור ישיר לאחסון שאפשר להעתיק, כל חתיכה עוברת בדיקת זכאות,
 * וכל בקשה לשרת קצרה (לא נחתכת במגבלת הזמן של Vercel).
 */
/** הקישור הפנימי לאחסון — השרת משתמש בו מיד, הוא לא יוצא לדפדפן */
const UPSTREAM_LINK_SECONDS = 60;

async function streamVideo(request: Request, lesson: Lesson, file: string) {
  const rangeHeader = request.headers.get("range");
  // בלי Range (הורדה רגילה, למשל מערכת בדיקה של סינון) — הקובץ השלם, כמו קובץ סטטי.
  // עם Range (הנגן) — חתיכה אחת לכל בקשה, כדי שכל בקשה תהיה קצרה.
  const range = rangeHeader ? clampVideoRange(rangeHeader) : undefined;
  if (rangeHeader && !range) return new Response(null, { status: 416 });
  const url = await signedMediaUrl(lesson, file, { expiresIn: UPSTREAM_LINK_SECONDS });
  if (!url) return notFound();

  const upstream = await fetch(url, range ? { headers: { Range: `bytes=${range.start}-${range.end}` } } : undefined);
  if (upstream.status === 416) return new Response(null, { status: 416 });
  if (!upstream.ok || !upstream.body) return notFound();

  const headers = new Headers({
    "Content-Type": "video/mp4",
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, no-store",
  });
  for (const name of ["Content-Range", "Content-Length"]) {
    const value = upstream.headers.get(name);
    if (value) headers.set(name, value);
  }
  return new Response(upstream.body, { status: upstream.status === 206 ? 206 : 200, headers });
}

/** אתר חי: הקבצים באחסון פרטי ב-Supabase. נקרא רק אחרי בדיקת הזכאות שלמעלה. */
async function serveFromStorage(request: Request, lesson: Lesson, file: string) {
  const isVideo = path.extname(file).toLowerCase() === ".mp4";
  if (isVideo && !mayStreamVideo(request.headers.get("user-agent"))) {
    return new Response("Videos are available in the course app only", { status: 403 });
  }
  const view = new URL(request.url).searchParams.get("view") === "1";

  // מטלות קטנות — מוגשות מכתובת האתר עצמו (לא הפניה לאחסון), כדי שיעבדו גם ברשתות מסוננות.
  if (!isVideo) {
    const blob = await readStoredFile(lesson, file);
    if (!blob) return notFound();
    const ext = path.extname(file).toLowerCase();
    return new Response(blob, {
      status: 200,
      headers: {
        "Content-Type": contentTypes[ext] ?? "application/octet-stream",
        "Content-Length": String(blob.size),
        "Content-Disposition": `${view ? "inline" : "attachment"}; filename*=UTF-8''${encodeURIComponent(file)}`,
        "Cache-Control": "private, no-store",
      },
    });
  }

  return streamVideo(request, lesson, file);
}

export async function GET(request: Request, ctx: RouteContext<"/api/media/[slug]/[file]">) {
  const { slug, file } = await ctx.params;
  const lesson = (await loadLessonForViewer(slug, isAdminRequest))?.lesson;
  if (!lesson) return notFound();

  // חלון זמני לבדיקת סינון (lib/public-video.ts): רק סרטונים פתוחים בלי התחברות, עד התאריך שנקבע.
  const isVideo = path.extname(safeDecode(file)).toLowerCase() === ".mp4";
  const publicVideo = isVideo && isPublicVideoWindow(process.env.PUBLIC_VIDEO_UNTIL);
  if (!publicVideo) {
    const access = await getLessonAccess(lesson.slug);
    if (access === "login") return new Response("Login required", { status: 401 });
    if (access !== "ok") return new Response("Forbidden", { status: 403 });
  }

  if (mediaSource === "supabase") return serveFromStorage(request, lesson, safeDecode(file));

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
