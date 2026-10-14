// חלון זמני שבו כתובות הסרטונים (/api/media/.../*.mp4) פתוחות בלי התחברות —
// כדי שמערכת סינון (נטפרי) תוכל לבדוק ולאשר כל כתובת קבועה פעם אחת.
// רק סרטונים: דפי האתר והמטלות נשארים נעולים. נסגר לבד בתאריך שנקבע.
// הגדרה: PUBLIC_VIDEO_UNTIL=YYYY-MM-DD ב-Vercel. למחוק = לסגור מיד.

/** חלון כזה לא יכול להיות ארוך מזה — גם אם הוגדר בטעות לתקופה ארוכה */
export const MAX_PUBLIC_VIDEO_DAYS = 14;

export function isPublicVideoWindow(until: string | undefined, now: number = Date.now()): boolean {
  if (!until || !/^\d{4}-\d{2}-\d{2}$/.test(until)) return false;
  const end = Date.parse(`${until}T23:59:59Z`);
  if (Number.isNaN(end) || end <= now) return false;
  return end - now <= MAX_PUBLIC_VIDEO_DAYS * 24 * 60 * 60 * 1000;
}
