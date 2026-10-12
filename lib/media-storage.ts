import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";
import type { Lesson } from "./course";
import { createSupabaseAdminClient } from "./supabase/admin";

// אחסון קובצי השיעורים (סרטונים ומטלות). אותו קוד בדיוק במחשב ובאתר החי —
// ההבדל היחיד הוא איפה הקבצים נמצאים, וזה נקבע בהגדרות (משתני סביבה):
//   MEDIA_SOURCE  — local (ברירת מחדל): קבצים מהתיקיות במחשב. supabase: מאחסון פרטי ב-Supabase.
//   CONTENT_DIR   — תיקיית המקור (ברירת מחדל: content-source)
//   COMPRESSED_DIR — סרטונים דחוסים מתחת למגבלת הגודל של האחסון (scripts/compress-large.mjs) — עדיפות ראשונה
//   ENHANCED_DIR  — סרטונים עם שמע משופר (scripts/enhance-audio.mjs) — עדיפות שנייה (ברירת מחדל: content-enhanced)
//   PROCESSED_DIR — גרסאות faststart — עדיפות שלישית (ברירת מחדל: content-processed)

export const MEDIA_BUCKET = "course-media";
export const mediaSource: "local" | "supabase" = process.env.MEDIA_SOURCE === "supabase" ? "supabase" : "local";

// turbopackIgnore: הנתיבים נקבעים בזמן ריצה — לא לארוז את תיקיות התוכן לתוך קוד השרת.
const contentRoot = path.resolve(/* turbopackIgnore: true */ process.env.CONTENT_DIR ?? "content-source");
const processedRoot = path.resolve(/* turbopackIgnore: true */ process.env.PROCESSED_DIR ?? "content-processed");
const enhancedRoot = path.resolve(/* turbopackIgnore: true */ process.env.ENHANCED_DIR ?? "content-enhanced");
const compressedRoot = path.resolve(/* turbopackIgnore: true */ process.env.COMPRESSED_DIR ?? "content-compressed");
/** סדר העדיפויות כשאותו קובץ קיים בכמה גרסאות */
const preferredRoots = [compressedRoot, enhancedRoot, processedRoot];

export type MediaVideo = { file: string; title: string };
export type MediaAssignment = { file: string; title: string; format: string };
export type LessonFiles = { videos: MediaVideo[]; assignments: MediaAssignment[] };

const videoExt = new Set([".mp4"]);
const assignmentExt = new Set([".docx", ".pdf", ".zip"]);

/** מספר החלק מתוך שמות כמו "1.2.4.6-LESS1_1" או "less5_2-5.8.10" */
function partNumber(base: string): number | undefined {
  const match = /less\d+_(\d+)/i.exec(base);
  return match?.[1] ? Number(match[1]) : undefined;
}

function videoTitle(base: string, index: number): string {
  if (/[֐-׿]/.test(base)) return base;
  const solution = /solution to exercise\s*(\d+)/i.exec(base);
  if (solution) return `פתרון תרגיל ${solution[1]}`;
  return `סרטון ${index + 1}`;
}

/** סדר וכותרות לקובצי שיעור לפי השמות שלהם — זהה לקבצים במחשב ובאחסון. */
export function buildLessonFiles(names: readonly string[]): LessonFiles {
  const files = names.filter((name) => !name.startsWith("~$"));

  const videos = files
    .filter((name) => videoExt.has(path.extname(name).toLowerCase()))
    .toSorted((a, b) => {
      const pa = partNumber(a) ?? Number.MAX_SAFE_INTEGER;
      const pb = partNumber(b) ?? Number.MAX_SAFE_INTEGER;
      return pa - pb || a.localeCompare(b);
    })
    .map((file, i) => ({ file, title: videoTitle(path.parse(file).name, i) }));

  const assignments = files
    .filter((name) => assignmentExt.has(path.extname(name).toLowerCase()))
    .toSorted((a, b) => a.localeCompare(b))
    .map((file) => ({
      file,
      title: path.parse(file).name,
      format: path.extname(file).slice(1).toUpperCase(),
    }));

  return { videos, assignments };
}

type StoredFile = { file_name: string; storage_key: string };

async function storedLessonFiles(lesson: Lesson): Promise<StoredFile[]> {
  const { data, error } = await createSupabaseAdminClient()
    .from("lesson_media")
    .select("file_name, storage_key")
    .eq("lesson_dir", lesson.sourceDir);
  if (error || !data) return [];
  return data as StoredFile[];
}

export async function getLessonFiles(lesson: Lesson): Promise<LessonFiles> {
  if (mediaSource === "supabase") {
    return buildLessonFiles((await storedLessonFiles(lesson)).map((row) => row.file_name));
  }
  const entries = await readdir(path.join(/* turbopackIgnore: true */ contentRoot, lesson.sourceDir), { withFileTypes: true }).catch(() => []);
  return buildLessonFiles(entries.filter((entry) => entry.isFile()).map((entry) => entry.name));
}

/** מחזיר נתיב מלא רק לקובץ שבאמת קיים ברשימת קובצי השיעור — חוסם ניסיונות לצאת מהתיקייה. */
export async function resolveMediaFile(lesson: Lesson, file: string): Promise<string | undefined> {
  const { videos, assignments } = await getLessonFiles(lesson);
  const allowed = [...videos, ...assignments].some((item) => item.file === file);
  if (!allowed) return undefined;
  for (const root of preferredRoots) {
    const candidate = path.join(/* turbopackIgnore: true */ root, lesson.sourceDir, file);
    if (existsSync(/* turbopackIgnore: true */ candidate)) return candidate;
  }
  return path.join(/* turbopackIgnore: true */ contentRoot, lesson.sourceDir, file);
}

/**
 * קישור חתום וזמני לקובץ באחסון הפרטי — רק לקובץ שרשום לשיעור הזה.
 * download — שם הקובץ להורדה; בלי — להצגה בתוך הדף (נגן / PDF).
 */
export async function signedMediaUrl(
  lesson: Lesson,
  file: string,
  opts: { expiresIn: number; download?: string },
): Promise<string | undefined> {
  const row = (await storedLessonFiles(lesson)).find((item) => item.file_name === file);
  if (!row) return undefined;
  const { data, error } = await createSupabaseAdminClient()
    .storage.from(MEDIA_BUCKET)
    .createSignedUrl(row.storage_key, opts.expiresIn, opts.download ? { download: opts.download } : undefined);
  if (error || !data) return undefined;
  return data.signedUrl;
}
