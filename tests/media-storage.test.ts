import { describe, expect, it, vi } from "vitest";

// מצב האחסון לא רלוונטי לבדיקה הזו — רק הסדר והכותרות.
vi.mock("@/lib/supabase/admin", () => ({ createSupabaseAdminClient: () => ({}) }));
const { buildLessonFiles } = await import("@/lib/media-storage");

describe("buildLessonFiles", () => {
  it("ממיין סרטונים לפי מספר החלק ונותן כותרות", () => {
    const { videos } = buildLessonFiles([
      "1.14.16-LESS1_3.mp4",
      "1.2.4.6-LESS1_1.mp4",
      "Solution to Exercise 1.mp4",
      "1.8.12-LESS1_2.mp4",
    ]);
    expect(videos.map((v) => v.title)).toEqual(["סרטון 1", "סרטון 2", "סרטון 3", "פתרון תרגיל 1"]);
  });

  it("מפריד מטלות, מתעלם מקבצים זמניים של Word ומסוגים לא מוכרים", () => {
    const { videos, assignments } = buildLessonFiles(["Practice Lesson 1.pdf", "Practice Lesson 1.docx", "~$actice.docx", "notes.txt"]);
    expect(videos).toEqual([]);
    expect(assignments.map((a) => a.format)).toEqual(["DOCX", "PDF"]);
  });

  it("שם סרטון בעברית נשאר ככותרת", () => {
    expect(buildLessonFiles(["התקנת סביבת עבודה.mp4"]).videos[0]?.title).toBe("התקנת סביבת עבודה");
  });
});
