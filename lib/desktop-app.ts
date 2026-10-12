// הממשק שאפליקציית המחשב (desktop/preload.js) חושפת לאתר. בדפדפן רגיל — undefined.

export type CourseAppBridge = {
  isDesktopApp: true;
  /** נקרא עם רשימת תוכנות ההקלטה הפתוחות (ריקה = אין). מחזיר פונקציית ביטול. */
  onCaptureState(callback: (recorders: string[]) => void): () => void;
};

declare global {
  interface Window {
    courseApp?: CourseAppBridge;
  }
}

export function getCourseApp(): CourseAppBridge | undefined {
  return typeof window === "undefined" ? undefined : window.courseApp;
}
