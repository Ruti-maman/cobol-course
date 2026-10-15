// "המשיכי מאיפה שעצרת": הסרטון האחרון שהלומדת צפתה בו (שיעור + מספר הסרטון).
// נשמר בדפדפן — עובד בכל מכשיר בנפרד. הנקודה בתוך הסרטון נשמרת בנפרד (pos:<שיעור>:<סרטון>).

export type LastWatched = { slug: string; index: number };

const KEY = "lastWatched";

/** מפרש ערך שמור; כל ערך פגום → null (ואז מתחילים מהשיעור הראשון). */
export function parseLastWatched(raw: string | null): LastWatched | null {
  if (!raw) return null;
  try {
    const v: unknown = JSON.parse(raw);
    if (typeof v !== "object" || v === null) return null;
    const { slug, index } = v as Record<string, unknown>;
    if (typeof slug !== "string" || !/^[a-z0-9-]+$/.test(slug)) return null;
    if (typeof index !== "number" || !Number.isInteger(index) || index < 0) return null;
    return { slug, index };
  } catch {
    return null;
  }
}

/** מספר הסרטון מכתובת הדף (?v=2); מחוץ לטווח → הסרטון הראשון. */
export function parseVideoIndex(value: unknown, videoCount: number): number {
  const n = typeof value === "string" ? Number(value) : NaN;
  return Number.isInteger(n) && n >= 0 && n < videoCount ? n : 0;
}

export function lessonHref({ slug, index }: LastWatched): string {
  return index > 0 ? `/lessons/${slug}?v=${index}` : `/lessons/${slug}`;
}

export function saveLastWatched(value: LastWatched) {
  try {
    localStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    // אחסון חסום — פשוט לא נזכור.
  }
}

export function loadLastWatched(): LastWatched | null {
  try {
    return parseLastWatched(localStorage.getItem(KEY));
  } catch {
    return null;
  }
}
