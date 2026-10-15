// מעבדת PIC: מפרקת הגדרת PIC של COBOL ומחשבת גודל, טווח ודוגמה.
// תומך בסמלים הבסיסיים: 9 (ספרה), X (תו), A (אות), S (סימן), V (נקודה עשרונית משתמעת),
// עם חזרות בסוגריים — 9(5), X(10). שימושים: DISPLAY (ברירת מחדל) ו-COMP-3 (packed decimal).

export type PicUsage = "display" | "comp3";

export type PicResult =
  | {
      ok: true;
      kind: "numeric";
      signed: boolean;
      intDigits: number;
      decDigits: number;
      bytes: number;
      min: string;
      max: string;
      example: string;
    }
  | { ok: true; kind: "alphanumeric" | "alphabetic"; length: number; bytes: number; example: string }
  | { ok: false; error: string };

const MAX_DIGITS = 31;
const MAX_LENGTH = 9999;

/** "S9(5)V99" → ["S","9","9","9","9","9","V","9","9"] */
function expand(pic: string): string[] | string {
  const out: string[] = [];
  const re = /([9XAVS])(?:\((\d{1,4})\))?/gy;
  let pos = 0;
  while (pos < pic.length) {
    re.lastIndex = pos;
    const m = re.exec(pic);
    if (!m || !m[1]) return `הסמל "${pic[pos]}" לא נתמך בכלי הזה (נתמכים: 9, X, A, S, V)`;
    const count = m[2] ? Number(m[2]) : 1;
    if (count < 1) return "מספר החזרות בסוגריים חייב להיות לפחות 1";
    if ((m[1] === "S" || m[1] === "V") && count > 1) return `${m[1]} מופיע פעם אחת בלבד`;
    for (let i = 0; i < count; i++) out.push(m[1]);
    if (out.length > MAX_LENGTH) return "ההגדרה ארוכה מדי";
    pos = re.lastIndex;
  }
  return out;
}

export function parsePic(input: string, usage: PicUsage = "display"): PicResult {
  const pic = input
    .trim()
    .toUpperCase()
    .replace(/^PIC(TURE)?\s+(IS\s+)?/, "")
    .replace(/\.$/, "")
    .replace(/\s+/g, "");
  if (!pic) return { ok: false, error: "הקלידי הגדרה, למשל ‎S9(5)V99" };

  const symbols = expand(pic);
  if (typeof symbols === "string") return { ok: false, error: symbols };

  const has = (c: string) => symbols.includes(c);
  const isNumeric = symbols.every((c) => c === "9" || c === "S" || c === "V");

  if (!isNumeric) {
    if (has("S") || has("V")) return { ok: false, error: "S ו-V שייכים רק לשדה מספרי (עם 9)" };
    if (usage === "comp3") return { ok: false, error: "COMP-3 מתאים רק לשדה מספרי" };
    const kind = symbols.every((c) => c === "A") ? "alphabetic" : "alphanumeric";
    const length = symbols.length;
    const sample = kind === "alphabetic" ? "SHALOM" : "COBOL-2026";
    return { ok: true, kind, length, bytes: length, example: sample.padEnd(length, " ").slice(0, length) };
  }

  if (symbols.indexOf("S") > 0) return { ok: false, error: "S חייב להופיע בתחילת ההגדרה" };
  const signed = has("S");
  const digits = symbols.filter((c) => c !== "S");
  const vAt = digits.indexOf("V");
  const intDigits = (vAt === -1 ? digits : digits.slice(0, vAt)).filter((c) => c === "9").length;
  const decDigits = vAt === -1 ? 0 : digits.slice(vAt + 1).filter((c) => c === "9").length;
  const total = intDigits + decDigits;
  if (total === 0) return { ok: false, error: "שדה מספרי צריך לפחות ספרה אחת (9)" };
  if (total > MAX_DIGITS) return { ok: false, error: `עד ${MAX_DIGITS} ספרות בשדה מספרי` };

  // DISPLAY: בית לכל ספרה (הסימן משולב בספרה האחרונה). COMP-3: שתי ספרות בבית + חצי בית לסימן.
  const bytes = usage === "comp3" ? Math.floor(total / 2) + 1 : total;
  const nines = (n: number) => "9".repeat(n);
  const fmt = (int: string, dec: string) => (decDigits ? `${int}.${dec}` : int);
  const max = fmt(intDigits ? nines(intDigits) : "0", nines(decDigits));
  const min = signed ? `-${max}` : fmt("0", "0".repeat(decDigits));
  const exInt = intDigits ? "1234567890123456789012345678901".slice(0, intDigits).replace(/^0+(?=\d)/, "") : "0";
  const example = (signed ? "-" : "") + fmt(exInt, "5".repeat(decDigits));

  return { ok: true, kind: "numeric", signed, intDigits, decDigits, bytes, min, max, example };
}
