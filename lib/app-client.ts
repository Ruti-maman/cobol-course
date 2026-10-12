// זיהוי בקשות שמגיעות מאפליקציית הצפייה (desktop/main.js מוסיפה CobolCourseApp ל-User-Agent).
// שלב ביניים בלבד: User-Agent אפשר לזייף. באתר החי הניגון יחייב גם טוקן חתום וקצר-מועד
// שנוצר בשרת אחרי בדיקת התחברות וזכאות (CLAUDE.md סעיף 6.4).

export const APP_UA_MARKER = "CobolCourseApp/";

export function isDesktopAppRequest(userAgent: string | null): boolean {
  return userAgent?.includes(APP_UA_MARKER) ?? false;
}

/**
 * האם לחייב צפייה באפליקציה בלבד. אותו כלל במחשב ובאתר החי — נקבע בהגדרה אחת:
 * REQUIRE_APP=1 → סרטונים רק באפליקציית הצפייה. בלי ההגדרה → גם בדפדפן.
 */
export const requireDesktopApp = process.env.REQUIRE_APP === "1";

export function mayStreamVideo(userAgent: string | null): boolean {
  return !requireDesktopApp || isDesktopAppRequest(userAgent);
}
