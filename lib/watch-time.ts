// מדידת זמן צפייה בפועל — רק בזמן שהסרטון מתנגן, בלי "לספור" דילוגים או לשונית שנשכחה פתוחה.

/** כמה שניות להוסיף בין שתי מדידות. פער גדול (מחשב נרדם, לשונית מושהית) לא נספר. */
export function playedDelta(lastMs: number | null, nowMs: number, playing: boolean): number {
  if (!playing || lastMs === null) return 0;
  const delta = (nowMs - lastMs) / 1000;
  return delta > 0 && delta <= 5 ? delta : 0;
}

/** מכמה שניות שולחים לשרת (פעם בדקה), ומה התקרה לשליחה אחת. */
export const FLUSH_EVERY_SECONDS = 60;
export const MAX_SECONDS_PER_REPORT = 120;

/** סיכום פעילות לתצוגה: "3 שעות ו-20 דקות" / "45 דקות" / "פחות מדקה". */
export function formatWatchTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  if (minutes < 1) return totalSeconds > 0 ? "פחות מדקה" : "—";
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const h = hours === 1 ? "שעה" : hours === 2 ? "שעתיים" : `${hours} שעות`;
  const m = rest === 1 ? "דקה" : `${rest} דקות`;
  if (!hours) return m;
  return rest ? `${h} ו-${m}` : h;
}
