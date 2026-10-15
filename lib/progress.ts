// מעקב התקדמות: אילו סרטונים נצפו (כמעט) עד הסוף. נשמר בדפדפן — לכל מכשיר בנפרד.
// מפתח לכל סרטון: "<שיעור>:<מספר הסרטון>" — לפי מספר ולא לפי שם קובץ, כך שזה עובד גם כשהקבצים מוחלפים.

const KEY = "watched";
const EVENT = "progress-change";

export function videoKey(slug: string, index: number): string {
  return `${slug}:${index}`;
}

/** קריאה בטוחה של הרשימה השמורה — ערך פגום מתעלם ממנו. */
export function parseWatched(raw: string | null): Set<string> {
  if (!raw) return new Set();
  try {
    const v: unknown = JSON.parse(raw);
    if (!Array.isArray(v)) return new Set();
    return new Set(v.filter((x): x is string => typeof x === "string" && /^[a-z0-9-]+:\d+$/.test(x)));
  } catch {
    return new Set();
  }
}

/** כמה סרטונים מתוך השיעור נצפו. */
export function lessonDone(watched: ReadonlySet<string>, slug: string, videoCount: number): number {
  let n = 0;
  for (let i = 0; i < videoCount; i++) if (watched.has(videoKey(slug, i))) n++;
  return n;
}

/** אחוז ההתקדמות בקורס כולו, לפי כל הסרטונים שבשיעורים המפורסמים. */
export function coursePercent(watched: ReadonlySet<string>, lessons: readonly { slug: string; videoCount: number }[]): number {
  const total = lessons.reduce((s, l) => s + l.videoCount, 0);
  if (total === 0) return 0;
  const done = lessons.reduce((s, l) => s + lessonDone(watched, l.slug, l.videoCount), 0);
  return Math.round((done / total) * 100);
}

// ── גישה לאחסון (בדפדפן בלבד) ──
export function readWatchedRaw(): string {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

export function markWatched(slug: string, index: number) {
  try {
    const set = parseWatched(localStorage.getItem(KEY));
    const key = videoKey(slug, index);
    if (set.has(key)) return;
    set.add(key);
    localStorage.setItem(KEY, JSON.stringify([...set]));
    window.dispatchEvent(new Event(EVENT));
  } catch {
    // אחסון חסום — לא נזכור.
  }
}

export function subscribeWatched(callback: () => void): () => void {
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) callback();
  };
  window.addEventListener(EVENT, callback);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(EVENT, callback);
    window.removeEventListener("storage", onStorage);
  };
}
