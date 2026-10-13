// יוצר קישור בדיקה זמני (למשל לבודקי נטפרי) שפותח את כל השיעורים בלי התחברות.
// שימוש: node --env-file=.env.local scripts/review-link.mjs [ימים=14]
// דורש REVIEW_SECRET ב-.env.local — אותו ערך בדיוק כמו ב-Vercel. מקסימום 30 יום.

import { createHmac } from "node:crypto";

const SITE = process.env.SITE_URL || "https://cobol-course.vercel.app";
const secret = process.env.REVIEW_SECRET;
if (!secret || secret.length < 32) {
  console.error("חסר REVIEW_SECRET (32 תווים לפחות) ב-.env.local");
  process.exit(1);
}

const days = Math.min(30, Math.max(1, Number(process.argv[2] ?? 14)));
const until = new Date(Date.now() + (days - 1) * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
const sig = createHmac("sha256", secret).update(`review:${until}`).digest("base64url");

console.log(`${SITE}/review?until=${until}&sig=${sig}`);
console.log(`תקף עד סוף ${until} (UTC).`);
