import { describe, expect, it } from "vitest";
import { lessonHref, parseLastWatched, parseVideoIndex } from "@/lib/last-watched";

describe("parseLastWatched", () => {
  it("קורא ערך תקין", () => {
    expect(parseLastWatched('{"slug":"files","index":2}')).toEqual({ slug: "files", index: 2 });
  });
  it("ערך פגום או חשוד → null", () => {
    expect(parseLastWatched(null)).toBeNull();
    expect(parseLastWatched("not json")).toBeNull();
    expect(parseLastWatched('{"slug":"../admin","index":0}')).toBeNull();
    expect(parseLastWatched('{"slug":"files","index":-1}')).toBeNull();
    expect(parseLastWatched('{"slug":"files","index":1.5}')).toBeNull();
  });
});

describe("parseVideoIndex", () => {
  it("מספר בטווח", () => expect(parseVideoIndex("2", 4)).toBe(2));
  it("מחוץ לטווח או לא מספר → הסרטון הראשון", () => {
    expect(parseVideoIndex("9", 4)).toBe(0);
    expect(parseVideoIndex("-1", 4)).toBe(0);
    expect(parseVideoIndex("abc", 4)).toBe(0);
    expect(parseVideoIndex(undefined, 4)).toBe(0);
  });
});

describe("lessonHref", () => {
  it("הסרטון הראשון — בלי פרמטר", () => expect(lessonHref({ slug: "setup", index: 0 })).toBe("/lessons/setup"));
  it("סרטון אחר — עם ?v=", () => expect(lessonHref({ slug: "files", index: 3 })).toBe("/lessons/files?v=3"));
});
