// ספירה בעברית תקינה: "שיעור אחד", "שני שיעורים", "5 שיעורים".

type Noun = { one: string; two: string; many: string };

export const nouns = {
  lesson: { one: "שיעור אחד", two: "שני שיעורים", many: "שיעורים" },
  video: { one: "סרטון אחד", two: "שני סרטונים", many: "סרטונים" },
  assignment: { one: "מטלה אחת", two: "שתי מטלות", many: "מטלות" },
} satisfies Record<string, Noun>;

export function countLabel(count: number, noun: Noun): string {
  if (count === 1) return noun.one;
  if (count === 2) return noun.two;
  return `${count} ${noun.many}`;
}
