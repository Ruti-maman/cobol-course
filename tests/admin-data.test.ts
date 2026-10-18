import type { User } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { loadLessonAccess, type AccessSource } from "@/lib/access";
import { summarizeLearners, type EntitlementRow } from "@/lib/admin-data";
import { activeSlugs } from "@/lib/admin-rules";
import { getPublishedLessons } from "@/lib/course";
import { rowToLesson, type LessonRow } from "@/lib/lessons-store";

const now = Date.parse("2026-10-18T12:00:00Z");

function user(id: string, email: string, created = "2026-10-01T00:00:00Z"): User {
  return { id, email, created_at: created, app_metadata: {}, user_metadata: {}, aud: "authenticated" } as User;
}
function ent(user_id: string, lesson_slug: string, expires_at: string | null): EntitlementRow {
  return { user_id, lesson_slug, expires_at, note: null, created_at: "2026-10-01T00:00:00Z" };
}

describe("סיכום לומדות לממשק הניהול", () => {
  const users = [user("u1", "pending@x.com"), user("u2", "active@x.com"), user("u3", "old@x.com")];
  const rows = [ent("u2", "a", "2027-10-18T00:00:00Z"), ent("u2", "b", "2027-10-18T00:00:00Z"), ent("u3", "a", "2025-10-18T00:00:00Z")];
  const byEmail = Object.fromEntries(summarizeLearners(users, rows, now).map((l) => [l.email, l]));

  it("נרשמה בלי זכאות → ממתינה לאישור", () => expect(byEmail["pending@x.com"]?.status).toBe("pending"));
  it("זכאות בתוקף → פעילה, עם מספר השיעורים ותאריך הסיום", () => {
    expect(byEmail["active@x.com"]).toMatchObject({ status: "active", lessons: 2, expiresAt: "2027-10-18T00:00:00Z" });
  });
  it("כל הזכאויות פגו → התוקף הסתיים, אפס שיעורים פתוחים", () => {
    expect(byEmail["old@x.com"]).toMatchObject({ status: "expired", lessons: 0 });
  });
});

describe("גישה לשיעור אחרי שהשנה הסתיימה", () => {
  // אותה לוגיקה כמו ב-lib/access-server.ts: רק זכאויות בתוקף נחשבות.
  const source = (rows: { lesson_slug: string; expires_at: string | null }[]): AccessSource => ({
    currentUserId: async () => "u1",
    entitledLessons: async () => activeSlugs(rows, now),
  });

  it("מי שהתוקף שלה פג — לא מקבלת גישה", async () => {
    expect(await loadLessonAccess(source([{ lesson_slug: "a", expires_at: "2026-10-17T00:00:00Z" }]), "a")).toBe("forbidden");
  });
  it("מי שהתוקף שלה בתוקף — מקבלת", async () => {
    expect(await loadLessonAccess(source([{ lesson_slug: "a", expires_at: "2027-10-17T00:00:00Z" }]), "a")).toBe("ok");
  });
  it("זכאות לשיעור אחר לא פותחת את השיעור הזה", async () => {
    expect(await loadLessonAccess(source([{ lesson_slug: "b", expires_at: null }]), "a")).toBe("forbidden");
  });
});

describe("שיעורים ממסד הנתונים", () => {
  const row: LessonRow = {
    slug: "lesson-8",
    position: 8,
    kind: "lesson",
    title: "מיון",
    summary: "",
    topics: null,
    status: "draft",
    source_dir: "less8",
    video_count: 0,
    assignment_count: 0,
  };
  it("הספירות מחושבות מהקבצים שהועלו (Word + PDF של אותה מטלה = מטלה אחת)", () => {
    const l = rowToLesson(row, ["less8_1.mp4", "less8_2.mp4", "Practice Lesson 8.pdf", "Practice Lesson 8.docx"]);
    expect(l).toMatchObject({ videoCount: 2, assignmentCount: 1, sourceDir: "less8", topics: [] });
  });
  it("טיוטה לא מופיעה באתר", () => {
    expect(getPublishedLessons([rowToLesson(row)])).toHaveLength(0);
  });
  it("המספור באתר רציף גם כששיעור באמצע מוסתר", () => {
    const lessons = [
      rowToLesson({ ...row, slug: "intro", kind: "intro", position: 0, status: "published" }),
      rowToLesson({ ...row, slug: "a", position: 1, status: "published" }),
      rowToLesson({ ...row, slug: "hidden", position: 2, status: "draft" }),
      rowToLesson({ ...row, slug: "c", position: 3, status: "published" }),
    ];
    expect(getPublishedLessons(lessons).map((l) => [l.slug, l.position])).toEqual([
      ["intro", 0],
      ["a", 1],
      ["c", 2],
    ]);
  });
});
