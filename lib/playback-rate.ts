// מהירות הניגון שהלומדת בחרה — נשמרת בדפדפן וחלה על כל סרטון הבא (גם בשיעורים אחרים).

const KEY = "playbackRate";

export function loadPlaybackRate(): number {
  try {
    const saved = Number(localStorage.getItem(KEY));
    // כל מהירות שהנגן מציע (0.25×–2×); ערך לא תקין → רגיל
    return saved >= 0.25 && saved <= 4 ? saved : 1;
  } catch {
    return 1;
  }
}

export function savePlaybackRate(rate: number) {
  try {
    localStorage.setItem(KEY, String(rate));
  } catch {
    // אחסון חסום — המהירות תחול רק עד רענון הדף.
  }
}

/** מחיל מהירות על אלמנט וידאו (מחוץ לקומפוננטה — כדי לא "לשנות props" מבחינת React). */
export function applyPlaybackRate(el: HTMLVideoElement | null, rate: number) {
  if (!el) return;
  el.defaultPlaybackRate = rate;
  el.playbackRate = rate;
}
