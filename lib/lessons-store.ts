import { cache } from "react";
import { CODE_LESSONS, getPublishedLessons, type Lesson } from "./course";
import { buildLessonFiles } from "./media-storage";
import { createSupabaseAdminClient } from "./supabase/admin";

// השיעורים — מטבלת lessons במסד הנתונים (ממשק הניהול), עם גיבוי לרשימה שבקוד (lib/course.ts).
// כל תקלה (טבלה עוד לא נוצרה, אין מפתח, מסד הנתונים לא זמין) → הרשימה שבקוד. האתר לא נשבר לעולם.

export type LessonRow = {
  slug: string;
  position: number;
  kind: "intro" | "lesson";
  title: string;
  summary: string;
  topics: string[] | null;
  status: "draft" | "published";
  source_dir: string;
  video_count: number;
  assignment_count: number;
};

/** שורה מהטבלה → שיעור. כשיש קבצים רשומים לשיעור — הספירות מחושבות מהם (ולא מהמספר השמור). */
export function rowToLesson(row: LessonRow, fileNames?: readonly string[]): Lesson {
  const files = fileNames?.length ? buildLessonFiles(fileNames) : undefined;
  return {
    slug: row.slug,
    position: row.position,
    kind: row.kind === "intro" ? "intro" : "lesson",
    title: row.title,
    summary: row.summary,
    topics: row.topics ?? [],
    status: row.status === "published" ? "published" : "draft",
    sourceDir: row.source_dir,
    videoCount: files ? files.videos.length : row.video_count,
    // אותה מטלה ב-Word וב-PDF = מטלה אחת
    assignmentCount: files ? new Set(files.assignments.map((a) => a.title)).size : row.assignment_count,
  };
}

export type LessonsResult = { lessons: Lesson[]; fromDb: boolean };

/** כל השיעורים (כולל טיוטות), לפי הסדר. פעם אחת לכל בקשה. */
export const loadAllLessons = cache(async (): Promise<LessonsResult> => {
  const fallback: LessonsResult = { lessons: CODE_LESSONS.toSorted((a, b) => a.position - b.position), fromDb: false };
  if (!process.env.SUPABASE_SECRET_KEY) return fallback;
  try {
    const db = createSupabaseAdminClient();
    const [lessonsRes, mediaRes] = await Promise.all([
      db.from("lessons").select("slug, position, kind, title, summary, topics, status, source_dir, video_count, assignment_count").order("position"),
      db.from("lesson_media").select("lesson_dir, file_name"),
    ]);
    if (lessonsRes.error || !lessonsRes.data?.length) return fallback;
    const byDir = new Map<string, string[]>();
    for (const m of (mediaRes.data ?? []) as { lesson_dir: string; file_name: string }[]) {
      byDir.set(m.lesson_dir, [...(byDir.get(m.lesson_dir) ?? []), m.file_name]);
    }
    const lessons = (lessonsRes.data as LessonRow[]).map((row) => rowToLesson(row, byDir.get(row.source_dir)));
    return { lessons, fromDb: true };
  } catch {
    return fallback;
  }
});

export async function loadPublishedLessons(): Promise<Lesson[]> {
  return getPublishedLessons((await loadAllLessons()).lessons);
}

export async function loadPublishedLesson(slug: string): Promise<Lesson | undefined> {
  return (await loadPublishedLessons()).find((lesson) => lesson.slug === slug);
}

/** שיעור לצפייה: מפורסם — לכולן; טיוטה — רק למנהלת (תצוגה מקדימה). isAdmin נבדק רק כשצריך. */
export async function loadLessonForViewer(
  slug: string,
  isAdmin: () => Promise<boolean>,
): Promise<{ lesson: Lesson; preview: boolean } | undefined> {
  const published = await loadPublishedLesson(slug);
  if (published) return { lesson: published, preview: false };
  if (!(await isAdmin())) return undefined;
  const draft = (await loadAllLessons()).lessons.find((lesson) => lesson.slug === slug);
  return draft && { lesson: draft, preview: true };
}
