/**
 * לאן לחזור אחרי ההתחברות. מקבל רק נתיב פנימי באתר ("/lessons/x"),
 * כדי שקישור זדוני לא יוכל לשלוח את הלומדת לאתר אחר אחרי שהתחברה.
 */
export function safeNextPath(next: unknown, fallback = "/"): string {
  if (typeof next !== "string") return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f]/.test(next)) return fallback;
  return next;
}
