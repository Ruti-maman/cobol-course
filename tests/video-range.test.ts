import { describe, expect, it } from "vitest";
import { clampVideoRange } from "@/lib/video-range";

describe("clampVideoRange", () => {
  it("בקשה פתוחה (bytes=X-) נחתכת לחתיכה אחת", () => {
    expect(clampVideoRange("bytes=0-", 100)).toEqual({ start: 0, end: 99 });
    expect(clampVideoRange("bytes=500-", 100)).toEqual({ start: 500, end: 599 });
  });
  it("בקשה קטנה מחתיכה נשארת כמו שהיא", () => {
    expect(clampVideoRange("bytes=10-20", 100)).toEqual({ start: 10, end: 20 });
  });
  it("בקשה גדולה מחתיכה נחתכת", () => {
    expect(clampVideoRange("bytes=0-1000", 100)).toEqual({ start: 0, end: 99 });
  });
  it("בלי Range — החתיכה הראשונה", () => {
    expect(clampVideoRange(null, 100)).toEqual({ start: 0, end: 99 });
  });
  it("Range לא תקין — נדחה", () => {
    expect(clampVideoRange("bytes=20-10", 100)).toBeUndefined();
    expect(clampVideoRange("bytes=-500", 100)).toBeUndefined();
    expect(clampVideoRange("items=0-10", 100)).toBeUndefined();
  });
});
