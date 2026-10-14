import { describe, expect, it } from "vitest";
import { isPublicVideoWindow } from "@/lib/public-video";

const now = Date.parse("2026-10-14T12:00:00Z");

describe("isPublicVideoWindow", () => {
  it("בלי הגדרה — סגור", () => {
    expect(isPublicVideoWindow(undefined, now)).toBe(false);
    expect(isPublicVideoWindow("", now)).toBe(false);
  });
  it("עד תאריך עתידי קרוב — פתוח", () => {
    expect(isPublicVideoWindow("2026-10-21", now)).toBe(true);
  });
  it("נסגר לבד אחרי התאריך", () => {
    expect(isPublicVideoWindow("2026-10-13", now)).toBe(false);
    expect(isPublicVideoWindow("2026-10-21", Date.parse("2026-10-22T00:00:01Z"))).toBe(false);
  });
  it("יותר מ-14 יום קדימה — סגור (הגנה מטעות)", () => {
    expect(isPublicVideoWindow("2026-12-31", now)).toBe(false);
  });
  it("תאריך לא תקין — סגור", () => {
    expect(isPublicVideoWindow("21/10/2026", now)).toBe(false);
    expect(isPublicVideoWindow("2026-13-45", now)).toBe(false);
  });
});
