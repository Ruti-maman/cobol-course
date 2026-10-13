import { createHmac, timingSafeEqual } from "node:crypto";

// קישור בדיקה זמני — למשל לבודקי נטפרי — שפותח את כל השיעורים בלי התחברות.
// הקישור חתום בסוד (REVIEW_SECRET, רק בשרת) וכולל תאריך תפוגה; אי אפשר לזייף או להאריך אותו.
// ביטול מיידי של כל הקישורים: להחליף או למחוק את REVIEW_SECRET ב-Vercel.
// יצירת קישור: node --env-file=.env.local scripts/review-link.mjs <ימים>

export const REVIEW_COOKIE = "review_pass";
/** קישור בדיקה לא יכול להיות תקף יותר מזה — גם אם נוצר בטעות לתקופה ארוכה */
export const MAX_REVIEW_DAYS = 30;

export function reviewSignature(secret: string, until: string): string {
  return createHmac("sha256", secret).update(`review:${until}`).digest("base64url");
}

/** סוף היום (UTC) של תאריך בפורמט YYYY-MM-DD, או undefined אם לא תקין */
export function reviewExpiry(until: string): number | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(until)) return undefined;
  const end = Date.parse(`${until}T23:59:59Z`);
  return Number.isNaN(end) ? undefined : end;
}

export function isValidReviewPass(
  secret: string | undefined,
  until: string | null | undefined,
  sig: string | null | undefined,
  now: number = Date.now(),
): boolean {
  if (!secret || secret.length < 32 || !until || !sig) return false;
  const end = reviewExpiry(until);
  if (end === undefined || end <= now || end - now > MAX_REVIEW_DAYS * 24 * 60 * 60 * 1000) return false;
  const expected = Buffer.from(reviewSignature(secret, until));
  const got = Buffer.from(sig);
  return expected.length === got.length && timingSafeEqual(expected, got);
}

/** ערך העוגייה: "<until>.<sig>" */
export function parseReviewCookie(value: string | undefined): { until?: string; sig?: string } {
  if (!value) return {};
  const dot = value.indexOf(".");
  return dot < 0 ? {} : { until: value.slice(0, dot), sig: value.slice(dot + 1) };
}
