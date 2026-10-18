// כללים "טהורים" של צד הניהול — בלי מסד נתונים, כדי שאפשר יהיה לבדוק אותם.
import { createHash } from "node:crypto";

// ── מי מנהלת ───────────────────────────────────────────────────────────
/** ADMIN_EMAILS="a@x.com, b@y.com" → קבוצה באותיות קטנות. ריק/חסר = אין אף מנהלת (סגור). */
export function parseAdminEmails(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? "")
      .split(/[,;\s]+/)
      .map((e) => e.trim().toLowerCase())
      .filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)),
  );
}

export function isAdminEmail(email: string | null | undefined, raw: string | undefined): boolean {
  if (!email) return false;
  return parseAdminEmails(raw).has(email.trim().toLowerCase());
}

// ── תוקף זכאות ─────────────────────────────────────────────────────────
export const DAY_MS = 24 * 60 * 60 * 1000;

/** זכאות פעילה: בלי תאריך סיום, או שתאריך הסיום עוד לא הגיע. */
export function isEntitlementActive(expiresAt: string | null | undefined, now: number = Date.now()): boolean {
  if (!expiresAt) return true;
  const t = Date.parse(expiresAt);
  return Number.isNaN(t) ? false : t > now;
}

/** תאריך סיום חדש: X ימים מהיום — או מהסיום הנוכחי, אם הוא עוד בתוקף (הארכה לא "בולעת" ימים). */
export function extendExpiry(current: string | null | undefined, days: number, now: number = Date.now()): string {
  const base = current && isEntitlementActive(current, now) ? Date.parse(current) : now;
  return new Date(base + days * DAY_MS).toISOString();
}

/** מתוך שורות זכאות — השיעורים שהזכאות אליהם פעילה. */
export function activeSlugs(rows: readonly { lesson_slug: string; expires_at?: string | null }[], now: number = Date.now()): string[] {
  return rows.filter((r) => isEntitlementActive(r.expires_at, now)).map((r) => r.lesson_slug);
}

// ── העלאת קבצים ────────────────────────────────────────────────────────
export const UPLOAD_MAX_BYTES = 50 * 1024 * 1024; // המגבלה לקובץ במסלול החינמי של Supabase
export const UPLOAD_TYPES: Record<string, string> = {
  ".mp4": "video/mp4",
  ".pdf": "application/pdf",
  ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ".zip": "application/zip",
};

export function fileExt(name: string): string {
  const m = /\.[^.\\/]+$/.exec(name);
  return m ? m[0].toLowerCase() : "";
}

/** בדיקת קובץ לפני העלאה. מחזיר הודעת שגיאה בעברית, או null אם הכול תקין. */
export function validateUpload(name: string, size: number): string | null {
  const clean = name.trim();
  if (!clean || clean.length > 160) return "שם הקובץ ריק או ארוך מדי.";
  if (/[\\/\u0000-\u001f]/.test(clean) || clean.startsWith(".") || clean.startsWith("~$")) return "שם הקובץ לא תקין.";
  if (!UPLOAD_TYPES[fileExt(clean)]) return "אפשר להעלות רק סרטון MP4 או מטלה מסוג PDF, Word (DOCX) או ZIP.";
  if (!Number.isFinite(size) || size <= 0) return "הקובץ ריק.";
  if (size > UPLOAD_MAX_BYTES) return `הקובץ גדול מ-50MB (${(size / 1024 / 1024).toFixed(1)}MB). יש לדחוס אותו קודם.`;
  return null;
}

/** המפתח באחסון — באנגלית בלבד (האחסון לא מקבל עברית). זהה ל-scripts/upload-media.mjs. */
export function storageKey(dir: string, file: string): string {
  const hash = createHash("sha256").update(`${dir}/${file}`).digest("hex").slice(0, 20);
  return `${dir}/${hash}${fileExt(file)}`;
}

/** תיקייה לשיעור חדש: less<המספר הבא>. */
export function nextSourceDir(existing: readonly string[]): string {
  const nums = existing.map((d) => /^less(\d+)$/.exec(d)?.[1]).filter(Boolean).map(Number);
  return `less${nums.length ? Math.max(...nums) + 1 : 0}`;
}

/** "DIVISION, SECTION ,PIC" → ["DIVISION","SECTION","PIC"] */
export function parseTopics(raw: string): string[] {
  return raw
    .split(/[,\n]/)
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 20);
}
