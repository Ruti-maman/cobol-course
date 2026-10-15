import { describe, expect, it } from "vitest";
import { parsePic } from "@/lib/pic";

describe("parsePic — מספרי", () => {
  it("S9(5)V99: עם סימן, 5 שלמות + 2 עשרוניות, 7 בתים ב-DISPLAY", () => {
    const r = parsePic("S9(5)V99");
    expect(r).toMatchObject({ ok: true, kind: "numeric", signed: true, intDigits: 5, decDigits: 2, bytes: 7 });
    if (r.ok && r.kind === "numeric") {
      expect(r.max).toBe("99999.99");
      expect(r.min).toBe("-99999.99");
    }
  });

  it("COMP-3 של S9(5)V99: ‏7 ספרות → 4 בתים", () => {
    expect(parsePic("S9(5)V99", "comp3")).toMatchObject({ ok: true, bytes: 4 });
  });

  it("9(3) בלי סימן: טווח 0–999", () => {
    expect(parsePic("9(3)")).toMatchObject({ ok: true, bytes: 3, min: "0", max: "999" });
  });

  it("מקבל גם 'PIC 9(4).' עם המילה PIC ונקודה בסוף", () => {
    expect(parsePic("pic 9(4).")).toMatchObject({ ok: true, intDigits: 4, bytes: 4 });
  });

  it("V בלי ספרות שלמות: V99 → טווח 0.00–0.99", () => {
    expect(parsePic("V99")).toMatchObject({ ok: true, intDigits: 0, decDigits: 2, max: "0.99", min: "0.00" });
  });
});

describe("parsePic — תווים", () => {
  it("X(10): ‏10 בתים", () => {
    expect(parsePic("X(10)")).toMatchObject({ ok: true, kind: "alphanumeric", length: 10, bytes: 10 });
  });
  it("A(5): אותיות בלבד", () => {
    expect(parsePic("A(5)")).toMatchObject({ ok: true, kind: "alphabetic", length: 5 });
  });
});

describe("parsePic — שגיאות ברורות", () => {
  it("סמל לא נתמך", () => expect(parsePic("Z(5)").ok).toBe(false));
  it("S לא בהתחלה", () => expect(parsePic("9S").ok).toBe(false));
  it("S בשדה תווים", () => expect(parsePic("SX(3)").ok).toBe(false));
  it("יותר מ-31 ספרות", () => expect(parsePic("9(32)").ok).toBe(false));
  it("ריק", () => expect(parsePic("  ").ok).toBe(false));
  it("COMP-3 לשדה תווים", () => expect(parsePic("X(4)", "comp3").ok).toBe(false));
});
