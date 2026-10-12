import { describe, expect, it } from "vitest";
import { getCourseStats, getPublishedLessons, type Lesson } from "@/lib/course";
import { countLabel, nouns } from "@/lib/hebrew";

function lesson(overrides: Partial<Lesson>): Lesson {
  return {
    slug: "x",
    position: 1,
    kind: "lesson",
    title: "t",
    summary: "s",
    topics: [],
    videoCount: 1,
    assignmentCount: 1,
    status: "published",
    sourceDir: "less1",
    ...overrides,
  };
}

describe("getPublishedLessons", () => {
  it("מסתיר טיוטות וממיין לפי position", () => {
    const result = getPublishedLessons([
      lesson({ slug: "c", position: 3 }),
      lesson({ slug: "draft", position: 2, status: "draft" }),
      lesson({ slug: "a", position: 1 }),
    ]);
    expect(result.map((l) => l.slug)).toEqual(["a", "c"]);
  });

  it("שיעור שנוסף מופיע בלי שינוי קוד", () => {
    const base = [lesson({ slug: "a", position: 1 })];
    const extended = [...base, lesson({ slug: "new", position: 2 })];
    expect(getPublishedLessons(extended)).toHaveLength(2);
  });
});

describe("getCourseStats", () => {
  it("סופר שיעורים בלי המבוא, וסרטונים ומטלות מכולם", () => {
    const stats = getCourseStats([
      lesson({ kind: "intro", videoCount: 1, assignmentCount: 0 }),
      lesson({ videoCount: 3 }),
      lesson({ videoCount: 2 }),
    ]);
    expect(stats).toEqual({ lessons: 2, videos: 6, assignments: 2 });
  });
});

describe("countLabel", () => {
  it("מטפל ביחיד, זוגי ורבים", () => {
    expect(countLabel(1, nouns.lesson)).toBe("שיעור אחד");
    expect(countLabel(2, nouns.video)).toBe("שני סרטונים");
    expect(countLabel(7, nouns.lesson)).toBe("7 שיעורים");
  });
});
