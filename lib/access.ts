// בדיקת זכאות לשיעור — בצד השרת בלבד (CLAUDE.md סעיף 6.1).
// הזכאות היא לשיעור ספציפי, לפי רשימת השיעורים שנכללו ברכישה — לא "כל הקורס" (סעיף 4).
// כל תקלה (מסד נתונים לא זמין, טבלה חסרה וכו') → אין גישה. לעולם לא פותחים בברירת מחדל.

export type LessonAccess = "ok" | "login" | "forbidden";

export function decideLessonAccess(
  userId: string | null,
  entitledSlugs: readonly string[],
  lessonSlug: string,
): LessonAccess {
  if (!userId) return "login";
  return entitledSlugs.includes(lessonSlug) ? "ok" : "forbidden";
}

/**
 * מעקף לבדיקה במחשב בלבד: DEV_SKIP_ACCESS=1 ב-.env.local, ורק בסביבת פיתוח (npm run dev).
 * באתר החי (production) המעקף לא פועל בשום מצב, גם אם ההגדרה קיימת.
 */
export function devAccessBypass(env: { NODE_ENV?: string; DEV_SKIP_ACCESS?: string }): boolean {
  return env.NODE_ENV === "development" && env.DEV_SKIP_ACCESS === "1";
}

/** מקור הנתונים של הבדיקה — מופרד כדי שאפשר יהיה לבדוק אותה בלי מסד נתונים אמיתי. */
export type AccessSource = {
  /** המשתמשת המחוברת, או null */
  currentUserId(): Promise<string | null>;
  /** שיעורים מתוך lessonSlugs שהמשתמשת זכאית להם; null = שגיאה */
  entitledLessons(userId: string, lessonSlugs: readonly string[]): Promise<string[] | null>;
};

export async function loadLessonAccess(source: AccessSource, lessonSlug: string): Promise<LessonAccess> {
  try {
    const userId = await source.currentUserId();
    if (!userId) return "login";
    const entitled = await source.entitledLessons(userId, [lessonSlug]);
    if (!entitled) return "forbidden";
    return decideLessonAccess(userId, entitled, lessonSlug);
  } catch {
    return "forbidden";
  }
}
