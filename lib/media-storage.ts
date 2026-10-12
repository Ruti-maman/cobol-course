import { existsSync } from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";
import type { Lesson } from "./course";

// אחסון קובצי השיעורים (סרטונים ומטלות). אותו קוד בדיוק במחשב ובאתר החי —
// ההבדל היחיד הוא איפה התיקיות נמצאות, וזה נקבע בהגדרות (משתני סביבה):
//   CONTENT_DIR   — תיקיית המקור (ברירת מחדל: content-source)
//   ENHANCED_DIR  — סרטונים עם שמע משופר (scripts/enhance-audio.mjs) — עדיפות ראשונה (ברירת מחדל: content-enhanced)
//   PROCESSED_DIR — גרסאות faststart — עדיפות שנייה (ברירת מחדל: content-processed)

// turbopackIgnore: הנתיבים נקבעים בזמן ריצה — לא לארוז את תיקיות התוכן לתוך קוד השרת.
const contentRoot = path.resolve(/* turbopackIgnore: true */ process.env.CONTENT_DIR ?? "content-source");
const processedRoot = path.resolve(/* turbopackIgnore: true */ process.env.PROCESSED_DIR ?? "content-processed");
const enhancedRoot = path.resolve(/* turbopackIgnore: true */ process.env.ENHANCED_DIR ?? "content-enhanced");
/** סדר העדיפויות כשאותו קובץ קיים בכמה גרסאות */
const preferredRoots = [enhancedRoot, processedRoot];

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

export async function getLessonFiles(lesson: Lesson): Promise<LessonFiles> {
  const entries = await readdir(path.join(/* turbopackIgnore: true */ contentRoot, lesson.sourceDir), { withFileTypes: true }).catch(() => []);
  const files = entries
    .filter((entry) => entry.isFile() && !entry.name.startsWith("~$"))
    .map((entry) => entry.name);

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
