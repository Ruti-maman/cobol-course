import { describe, expect, it } from "vitest";
import { decideLessonAccess, loadLessonAccess, type AccessSource } from "@/lib/access";
import { safeNextPath } from "@/lib/safe-next";

type Row = { user_id: string; lesson_slug: string };

/** מקור מדומה: מחזיר רק את השורות שמתאימות לסינון, כמו מסד הנתונים. */
function fakeClient(opts: { userId: string | null; rows?: Row[]; error?: boolean; throws?: boolean }): AccessSource {
  return {
    currentUserId: async () => {
      if (opts.throws) throw new Error("network");
      return opts.userId;
    },
    entitledLessons: async (userId, slugs) =>
      opts.error
        ? null
        : (opts.rows ?? []).filter((r) => r.user_id === userId && slugs.includes(r.lesson_slug)).map((r) => r.lesson_slug),
  };
}

describe("decideLessonAccess", () => {
  it("בלי התחברות — מפנה לכניסה", () => {
    expect(decideLessonAccess(null, ["files"], "files")).toBe("login");
  });
  it("מחוברת בלי זכאות — אין גישה", () => {
    expect(decideLessonAccess("u1", [], "files")).toBe("forbidden");
  });
  it("זכאות לשיעור אחר — אין גישה לשיעור הזה", () => {
    expect(decideLessonAccess("u1", ["conditions"], "files")).toBe("forbidden");
  });
  it("זכאות לשיעור — יש גישה", () => {
    expect(decideLessonAccess("u1", ["files"], "files")).toBe("ok");
  });
});

describe("loadLessonAccess", () => {
  const rows: Row[] = [{ user_id: "paid", lesson_slug: "files" }];

  it("מי שלא מחוברת לא מקבלת גישה", async () => {
    expect(await loadLessonAccess(fakeClient({ userId: null, rows }), "files")).toBe("login");
  });
  it("מי שלא שילמה לא מקבלת גישה", async () => {
    expect(await loadLessonAccess(fakeClient({ userId: "unpaid", rows }), "files")).toBe("forbidden");
  });
  it("זכאות של לומדת אחרת לא פותחת את השיעור", async () => {
    expect(await loadLessonAccess(fakeClient({ userId: "unpaid", rows }), "files")).toBe("forbidden");
  });
  it("שיעור שנוסף אחרי הרכישה לא נפתח אוטומטית", async () => {
    expect(await loadLessonAccess(fakeClient({ userId: "paid", rows }), "new-lesson")).toBe("forbidden");
  });
  it("מי ששילמה על השיעור מקבלת גישה", async () => {
    expect(await loadLessonAccess(fakeClient({ userId: "paid", rows }), "files")).toBe("ok");
  });
  it("שגיאת מסד נתונים — אין גישה", async () => {
    expect(await loadLessonAccess(fakeClient({ userId: "paid", rows, error: true }), "files")).toBe("forbidden");
  });
  it("תקלת רשת — אין גישה", async () => {
    expect(await loadLessonAccess(fakeClient({ userId: "paid", rows, throws: true }), "files")).toBe("forbidden");
  });
});

describe("safeNextPath", () => {
  it("מקבל נתיב פנימי", () => {
    expect(safeNextPath("/lessons/files")).toBe("/lessons/files");
  });
  it.each(["https://evil.example", "//evil.example", "/\\evil.example", "lessons", "/x\nSet-Cookie:a", undefined, ["/a"]])(
    "דוחה יעד חיצוני או לא תקין: %s",
    (value) => {
      expect(safeNextPath(value)).toBe("/");
    },
  );
});
