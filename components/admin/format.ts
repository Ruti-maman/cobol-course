// תאריכים ומספרים לתצוגה בצד הניהול — לפי שעון ישראל.

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("he-IL", { timeZone: "Asia/Jerusalem", day: "numeric", month: "numeric", year: "numeric" });
}

export function fmtDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("he-IL", { timeZone: "Asia/Jerusalem", day: "numeric", month: "numeric", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

export function fmtSize(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)}MB` : `${Math.max(1, Math.round(bytes / 1024))}KB`;
}

/** כמה ימים נשארו עד התאריך (שלילי = עבר). */
export function daysLeft(iso: string | null, now: number = Date.now()): number | null {
  if (!iso) return null;
  return Math.ceil((Date.parse(iso) - now) / (24 * 60 * 60 * 1000));
}
