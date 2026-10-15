import { describe, expect, it } from "vitest";
import { coursePercent, lessonDone, parseWatched, videoKey } from "@/lib/progress";

describe("parseWatched", () => {
  it("קורא רשימה תקינה ומתעלם מערכים פגומים", () => {
    const set = parseWatched(JSON.stringify(["files:0", "files:2", "../x:1", 5, "bad"]));
    expect([...set]).toEqual(["files:0", "files:2"]);
  });
  it("ערך שאינו JSON או אינו רשימה → ריק", () => {
    expect(parseWatched("oops").size).toBe(0);
    expect(parseWatched('{"a":1}').size).toBe(0);
    expect(parseWatched(null).size).toBe(0);
  });
});

describe("lessonDone / coursePercent", () => {
  const watched = new Set([videoKey("setup", 0), videoKey("files", 0), videoKey("files", 3), videoKey("files", 9)]);
  it("סופר רק סרטונים בטווח של השיעור", () => {
    expect(lessonDone(watched, "files", 4)).toBe(2); // files:9 מחוץ לטווח
    expect(lessonDone(watched, "setup", 1)).toBe(1);
  });
  it("אחוז מהקורס כולו", () => {
    expect(coursePercent(watched, [{ slug: "setup", videoCount: 1 }, { slug: "files", videoCount: 4 }])).toBe(60);
  });
  it("קורס בלי סרטונים → 0", () => expect(coursePercent(watched, [])).toBe(0));
});
