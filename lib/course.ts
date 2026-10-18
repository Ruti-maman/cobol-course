// נתוני הקורס. המקור הראשי: טבלת lessons במסד הנתונים (מנוהלת מממשק הניהול — lib/lessons-store.ts).
// הרשימה כאן היא גיבוי: משמשת כל עוד הטבלה לא קיימת או לא זמינה, כך שהאתר לא נשבר לעולם.
// אין להניח מספר קבוע של שיעורים: כל ספירה באתר מחושבת מהרשימה.

export type LessonStatus = "draft" | "published";

export type Lesson = {
  slug: string;
  position: number;
  kind: "intro" | "lesson";
  title: string;
  summary: string;
  topics: string[];
  videoCount: number;
  assignmentCount: number;
  status: LessonStatus;
  /** תיקיית המקור ב-content-source — לתצוגה מקדימה מקומית בלבד, עד חיבור שירות הסטרימינג */
  sourceDir: string;
};

export const CODE_LESSONS: readonly Lesson[] = [
  {
    slug: "setup",
    position: 0,
    kind: "intro",
    title: "התקנת סביבת עבודה",
    summary: "הכנת המחשב לכתיבה, קומפילציה והרצה של תכניות COBOL.",
    topics: ["סביבת עבודה", "סילבוס"],
    videoCount: 1,
    assignmentCount: 0,
    status: "published",
    sourceDir: "less0",
  },
  {
    slug: "program-structure",
    position: 1,
    kind: "lesson",
    title: "מבנה תכנית COBOL ופקודות בסיס",
    summary: "חלקי ה-DIVISION וה-SECTION, עמודות הקידוד, הגדרת משתנים ופקודות ראשונות.",
    topics: ["DIVISION", "SECTION", "PIC", "MOVE", "COMPUTE", "DISPLAY", "ACCEPT", "PERFORM"],
    videoCount: 4,
    assignmentCount: 1,
    status: "published",
    sourceDir: "less1",
  },
  {
    slug: "conditions",
    position: 2,
    kind: "lesson",
    title: "תנאים והיררכיית משתנים",
    summary: "התניות וקינון, רמות משתנים ו-GROUP ITEMS, ערכים מותנים ואתחול.",
    topics: ["IF", "EVALUATE", "01 / 03", "88", "VALUE", "INITIALIZE"],
    videoCount: 3,
    assignmentCount: 1,
    status: "published",
    sourceDir: "less2",
  },
  {
    slug: "debug-advanced",
    position: 3,
    kind: "lesson",
    title: "דיבאג והגדרות מתקדמות",
    summary: "עבודה עם נקודות עצירה, ופקודות והגדרות מתקדמות לעבודה עם נתונים.",
    topics: ["DEBUG", "BREAK POINT", "REDEFINES", "DATE / TIME", "MOVE CORRESPONDING"],
    videoCount: 2,
    assignmentCount: 1,
    status: "published",
    sourceDir: "less3",
  },
  {
    slug: "arrays-loops",
    position: 4,
    kind: "lesson",
    title: "מערכים ולולאות",
    summary: "מערכים ואינדקסים, ארגון ה-WORKING-STORAGE ולולאות מכל הסוגים.",
    topics: ["OCCURS", "INDEX", "PERFORM TIMES", "PERFORM UNTIL", "PERFORM VARYING"],
    videoCount: 3,
    assignmentCount: 1,
    status: "published",
    sourceDir: "less4",
  },
  {
    slug: "files",
    position: 5,
    kind: "lesson",
    title: "עבודה עם קבצים",
    summary: "הגדרת קבצים, פתיחה, קריאה וכתיבה, ולולאות על קבצים.",
    topics: ["FD", "FILE STATUS", "OPEN / CLOSE", "READ INTO", "WRITE FROM"],
    videoCount: 4,
    assignmentCount: 1,
    status: "published",
    sourceDir: "less5",
  },
  {
    slug: "subprograms",
    position: 6,
    kind: "lesson",
    title: "תתי-תכניות ורוטינות שירות",
    summary: "קריאה לתכניות אחרות והעברת נתונים ביניהן.",
    topics: ["CALL", "USING", "LINKAGE SECTION"],
    videoCount: 3,
    assignmentCount: 1,
    status: "published",
    sourceDir: "less6",
  },
  {
    slug: "indexed-files-final",
    position: 7,
    kind: "lesson",
    title: "קובץ ממופתח ופרויקט סיום",
    summary: "עדכון קובץ ממופתח, וסיכום כל החומר בפרויקט מסכם.",
    topics: ["INDEXED", "INVALID KEY", "REWRITE", "פרויקט סיום"],
    videoCount: 5,
    assignmentCount: 1,
    status: "published",
    sourceDir: "less7",
  },
];

/**
 * השיעורים המפורסמים לפי הסדר. position מחושב מחדש לפי הסדר בפועל (פתיחה = 0, שיעורים = 1, 2, 3…),
 * כך ששיעור מוסתר או שינוי סדר בממשק הניהול לא משאירים "חור" במספור.
 */
export function getPublishedLessons(source: readonly Lesson[] = CODE_LESSONS): Lesson[] {
  let n = 0;
  return source
    .filter((lesson) => lesson.status === "published")
    .toSorted((a, b) => a.position - b.position)
    .map((lesson) => ({ ...lesson, position: lesson.kind === "intro" ? 0 : ++n }));
}

export type CourseStats = { lessons: number; videos: number; assignments: number };

export function getCourseStats(published: readonly Lesson[]): CourseStats {
  return {
    lessons: published.filter((lesson) => lesson.kind === "lesson").length,
    videos: published.reduce((sum, lesson) => sum + lesson.videoCount, 0),
    assignments: published.reduce((sum, lesson) => sum + lesson.assignmentCount, 0),
  };
}
