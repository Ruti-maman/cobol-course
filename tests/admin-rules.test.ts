import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  activeSlugs,
  DAY_MS,
  extendExpiry,
  isAdminEmail,
  isEntitlementActive,
  nextSourceDir,
  parseAdminEmails,
  parseTopics,
  storageKey,
  validateUpload,
} from "@/lib/admin-rules";

describe("מי מנהלת", () => {
  it("רק מייל שברשימה — בלי תלות באותיות גדולות/קטנות", () => {
    expect(isAdminEmail("Owner@Example.com", "owner@example.com, other@x.co")).toBe(true);
    expect(isAdminEmail("learner@example.com", "owner@example.com")).toBe(false);
  });
  it("רשימה ריקה או חסרה → אף אחת לא מנהלת (ברירת מחדל סגורה)", () => {
    expect(isAdminEmail("owner@example.com", undefined)).toBe(false);
    expect(isAdminEmail("owner@example.com", "")).toBe(false);
    expect(parseAdminEmails("not-an-email, ,").size).toBe(0);
  });
  it("לא מחוברת → לא מנהלת", () => expect(isAdminEmail(null, "owner@example.com")).toBe(false));
});

describe("תוקף זכאות", () => {
  const now = Date.parse("2026-10-18T12:00:00Z");
  it("בלי תאריך סיום — פעילה", () => expect(isEntitlementActive(null, now)).toBe(true));
  it("תאריך עתידי — פעילה; עבר — לא", () => {
    expect(isEntitlementActive("2027-10-18T12:00:00Z", now)).toBe(true);
    expect(isEntitlementActive("2026-10-17T12:00:00Z", now)).toBe(false);
  });
  it("תאריך פגום → לא פעילה (לא פותחים בטעות)", () => expect(isEntitlementActive("garbage", now)).toBe(false));
  it("מי שהזכאות שלה פגה לא מקבלת את השיעור", () => {
    const rows = [
      { lesson_slug: "a", expires_at: "2027-01-01T00:00:00Z" },
      { lesson_slug: "b", expires_at: "2026-01-01T00:00:00Z" },
      { lesson_slug: "c", expires_at: null },
    ];
    expect(activeSlugs(rows, now)).toEqual(["a", "c"]);
  });
  it("הארכה בשנה: מהיום אם פג, ומהסיום הקיים אם עוד בתוקף", () => {
    expect(Date.parse(extendExpiry(null, 365, now))).toBe(now + 365 * DAY_MS);
    expect(Date.parse(extendExpiry("2026-01-01T00:00:00Z", 365, now))).toBe(now + 365 * DAY_MS);
    const future = "2026-12-01T00:00:00Z";
    expect(Date.parse(extendExpiry(future, 365, now))).toBe(Date.parse(future) + 365 * DAY_MS);
  });
});

describe("העלאת קבצים", () => {
  it("סוגים מותרים בלבד", () => {
    expect(validateUpload("חלק 1.mp4", 1000)).toBeNull();
    expect(validateUpload("מטלה.pdf", 1000)).toBeNull();
    expect(validateUpload("virus.exe", 1000)).not.toBeNull();
    expect(validateUpload("noext", 1000)).not.toBeNull();
  });
  it("שמות מסוכנים נחסמים", () => {
    expect(validateUpload("../../etc.pdf", 10)).not.toBeNull();
    expect(validateUpload(".hidden.pdf", 10)).not.toBeNull();
    expect(validateUpload("~$temp.docx", 10)).not.toBeNull();
  });
  it("עד 50MB", () => {
    expect(validateUpload("big.mp4", 51 * 1024 * 1024)).toMatch(/50MB/);
    expect(validateUpload("empty.pdf", 0)).not.toBeNull();
  });
  it("מפתח האחסון זהה לזה של סקריפט ההעלאה", () => {
    const expected = `less1/${createHash("sha256").update("less1/Practice Lesson 1.pdf").digest("hex").slice(0, 20)}.pdf`;
    expect(storageKey("less1", "Practice Lesson 1.pdf")).toBe(expected);
  });
});

describe("שיעור חדש", () => {
  it("תיקייה הבאה בתור", () => {
    expect(nextSourceDir(["less0", "less7", "less3"])).toBe("less8");
    expect(nextSourceDir([])).toBe("less0");
  });
  it("נושאים מופרדים בפסיק", () => expect(parseTopics("DIVISION, SECTION ,\nPIC,,")).toEqual(["DIVISION", "SECTION", "PIC"]));
});
