/** גודל חתיכה אחת של סרטון שמוגשת בבקשה אחת (app/api/media). */
export const VIDEO_CHUNK_BYTES = 4 * 1024 * 1024;

/**
 * חותך בקשת Range של הנגן לחתיכה אחת: "bytes=100-" → 100 עד 100+chunk-1.
 * בלי Range — החתיכה הראשונה. undefined = Range לא תקין.
 */
export function clampVideoRange(range: string | null, chunk = VIDEO_CHUNK_BYTES): { start: number; end: number } | undefined {
  if (!range) return { start: 0, end: chunk - 1 };
  const m = /^bytes=(\d+)-(\d*)$/.exec(range.trim());
  if (!m) return undefined;
  const start = Number(m[1]);
  const asked = m[2] ? Number(m[2]) : Number.POSITIVE_INFINITY;
  if (asked < start) return undefined;
  return { start, end: Math.min(asked, start + chunk - 1) };
}
