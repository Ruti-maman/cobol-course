import { headers } from "next/headers";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { LessonWorkspace } from "@/components/LessonWorkspace";
import { SiteHeader } from "@/components/SiteHeader";
import { getLessonAccess } from "@/lib/access-server";
import { mayStreamVideo } from "@/lib/app-client";
import { getPublishedLesson, getPublishedLessons } from "@/lib/course";
import { getLessonFiles } from "@/lib/media-storage";

// הדף מחייב התחברות + זכאות לשיעור הספציפי, בשרת (CLAUDE.md סעיף 6.1).
export default async function LessonPage(props: PageProps<"/lessons/[slug]">) {
  const { slug } = await props.params;
  const lesson = getPublishedLesson(slug);
  if (!lesson) notFound();

  const access = await getLessonAccess(lesson.slug);
  if (access === "login") redirect(`/login?next=${encodeURIComponent(`/lessons/${lesson.slug}`)}`);
  if (access !== "ok") {
    return (
      <>
        <SiteHeader wide />
        <main id="main" className="wrap placeholder">
          <p className="eyebrow">
            <b>◆</b> אין גישה לשיעור
          </p>
          <h1>{lesson.title}</h1>
          <p>השיעור הזה לא כלול ברכישה שלך. אם נראה לך שזו טעות, כתבי לנו ונבדוק.</p>
          <Link className="btn btn-2" href="/">
            חזרה לדף הבית
          </Link>
        </main>
      </>
    );
  }

  const inApp = mayStreamVideo((await headers()).get("user-agent"));
  const { videos, assignments } = await getLessonFiles(lesson);
  const media = (file: string) => `/api/media/${lesson.slug}/${encodeURIComponent(file)}`;

  const all = getPublishedLessons();
  const index = all.findIndex((l) => l.slug === lesson.slug);
  const prev = all[index - 1];
  const next = all[index + 1];
  const totalLessons = all.filter((l) => l.kind === "lesson").length;

  // אותה משימה בכמה פורמטים (Word + PDF) → משימה אחת עם כמה קבצים.
  const grouped = new Map<string, { format: string; src: string }[]>();
  for (const a of assignments) {
    grouped.set(a.title, [...(grouped.get(a.title) ?? []), { format: a.format, src: media(a.file) }]);
  }
  // כשיש PDF — מציגים רק אותו (קובצי Word נחסמים ברשתות מסוננות). Word מוצג רק אם אין PDF למשימה.
  const preferPdf = (files: { format: string; src: string }[]) =>
    files.some((f) => f.format === "PDF") ? files.filter((f) => f.format !== "DOCX") : files;
  // פרויקט הסיום מזוהה לפי שם הקובץ ("final project" / "פרויקט סיום") — לא לפי מספר שיעור קבוע.
  const isFinal = (title: string) => /final\s*project|פרויקט\s*סיום/i.test(title);
  const assignmentList = [...grouped].map(([title, all]) => {
    const files = preferPdf(all);
    return isFinal(title) ? { title: "פרויקט הסיום", files, final: true } : { title, files };
  });

  return (
    <>
      <SiteHeader wide />
      <main id="main" className="wrap lesson-page">
        <div className="head lesson-head">
          <p className="lesson-badge">
            {lesson.kind === "intro" ? (
              <strong>שיעור פתיחה</strong>
            ) : (
              <>
                <strong>שיעור {lesson.position}</strong>
                <span>מתוך {totalLessons}</span>
              </>
            )}
          </p>
          <h1>{lesson.title}</h1>
          <p>{lesson.summary}</p>
        </div>

        <LessonWorkspace
          lessonSlug={lesson.slug}
          videos={videos.map((v) => ({ title: v.title, src: media(v.file) }))}
          nextLesson={next && { href: `/lessons/${next.slug}`, label: `שיעור ${next.position}: ${next.title}` }}
          assignments={assignmentList}
          canPlay={inApp}
          navigation={
            <nav className="lesson-nav" aria-label="מעבר בין שיעורים">
              {prev ? (
                <Link className="nav-btn prev" href={`/lessons/${prev.slug}`}>
                  <span className="arrow" aria-hidden="true">→</span>
                  <span>
                    <small>הקודם</small>
                    {prev.kind === "intro" ? "פתיחה" : `שיעור ${prev.position}`}
                  </span>
                </Link>
              ) : (
                <span />
              )}
              {next && (
                <Link className="nav-btn next" href={`/lessons/${next.slug}`}>
                  <span>
                    <small>הבא</small>
                    שיעור {next.position}
                  </span>
                  <span className="arrow" aria-hidden="true">←</span>
                </Link>
              )}
            </nav>
          }
          fallback={
              <div className="app-only" role="note">
                <span className="ic" aria-hidden="true">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="4" width="18" height="12" rx="2" />
                    <path d="M8 20h8M12 16v4" />
                  </svg>
                </span>
                <h2>הסרטונים זמינים באפליקציית הקורס</h2>
                <p>
                  כדי להגן על תוכן הקורס, הצפייה בסרטונים נעשית באפליקציה ייעודית למחשב. בשיעור הזה{" "}
                  {videos.length === 1 ? "סרטון אחד" : `${videos.length} סרטונים`}. את המטלות אפשר להוריד גם כאן.
                </p>
                <a className="btn btn-1" href={`cobolcourse://lessons/${lesson.slug}`}>
                  <span className="shine" />
                  פתחי את השיעור באפליקציה
                </a>
              </div>
          }
        />

      </main>
    </>
  );
}
