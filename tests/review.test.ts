import { describe, expect, it } from "vitest";
import { isValidReviewPass, parseReviewCookie, reviewSignature } from "@/lib/review";

const secret = "x".repeat(40);
const now = Date.parse("2026-10-13T12:00:00Z");

describe("isValidReviewPass", () => {
  it("קישור חתום ובתוקף — פותח", () => {
    expect(isValidReviewPass(secret, "2026-10-20", reviewSignature(secret, "2026-10-20"), now)).toBe(true);
  });
  it("חתימה מזויפת — לא פותח", () => {
    expect(isValidReviewPass(secret, "2026-10-20", "fake", now)).toBe(false);
  });
  it("שינוי התאריך בקישור (הארכה) — לא פותח", () => {
    expect(isValidReviewPass(secret, "2026-11-01", reviewSignature(secret, "2026-10-20"), now)).toBe(false);
  });
  it("קישור שפג תוקפו — לא פותח", () => {
    expect(isValidReviewPass(secret, "2026-10-12", reviewSignature(secret, "2026-10-12"), now)).toBe(false);
  });
  it("יותר מ-30 יום קדימה — לא פותח", () => {
    expect(isValidReviewPass(secret, "2026-12-31", reviewSignature(secret, "2026-12-31"), now)).toBe(false);
  });
  it("בלי סוד בשרת, או סוד קצר — לא פותח", () => {
    const sig = reviewSignature(secret, "2026-10-20");
    expect(isValidReviewPass(undefined, "2026-10-20", sig, now)).toBe(false);
    expect(isValidReviewPass("short", "2026-10-20", reviewSignature("short", "2026-10-20"), now)).toBe(false);
  });
  it("הסוד הוחלף — קישורים ישנים לא פותחים", () => {
    expect(isValidReviewPass("y".repeat(40), "2026-10-20", reviewSignature(secret, "2026-10-20"), now)).toBe(false);
  });
  it("תאריך לא תקין — לא פותח", () => {
    expect(isValidReviewPass(secret, "20-10-2026", reviewSignature(secret, "20-10-2026"), now)).toBe(false);
  });
});

describe("parseReviewCookie", () => {
  it("מפרק עוגייה תקינה ומתעלם מריקה", () => {
    expect(parseReviewCookie("2026-10-20.abc")).toEqual({ until: "2026-10-20", sig: "abc" });
    expect(parseReviewCookie(undefined)).toEqual({});
    expect(parseReviewCookie("nodot")).toEqual({});
  });
});
