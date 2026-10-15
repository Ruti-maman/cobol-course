"use client";

import { useState } from "react";
import { type Assignment, AssignmentViewer } from "./AssignmentViewer";
import { LessonPlayer } from "./LessonPlayer";

type Props = {
  lessonSlug: string;
  /** הסרטון שמתחילים ממנו (‎?v=) */
  initialIndex?: number;
  videos: { title: string; src: string }[];
  /** סימן מים על הסרטון — כרגע ללא; אחרי בניית ההתחברות: שם + טלפון של הלומדת (CLAUDE.md 6.3) */
  watermark?: string;
  nextLesson?: { href: string; label: string };
  assignments: Assignment[];
  /** null = הסרטונים לא זמינים כאן (דפדפן באתר החי) — מוצגת במקומם ההודעה ב-fallback */
  canPlay: boolean;
  fallback: React.ReactNode;
  /** כפתורי מעבר בין שיעורים — בתחתית עמודת הצד */
  navigation: React.ReactNode;
};

/** הנגן + המשימות של השיעור, עם חלון צפייה משותף למשימה. */
export function LessonWorkspace({ lessonSlug, initialIndex, videos, watermark, nextLesson, assignments, canPlay, fallback, navigation }: Props) {
  const [open, setOpen] = useState<Assignment | null>(null);
  const first = assignments[0];

  const finals = assignments.filter((a) => a.final);
  const regular = assignments.filter((a) => !a.final);

  const side = (
    <>
      {regular.length > 0 && (
        <section className="side-block assignments" aria-labelledby="as-title">
          <h2 id="as-title" className="side-title">
            המשימה של השיעור
          </h2>
          <ul role="list">
            {regular.map((a) => (
              <li key={a.title} className="assignment">
                <button type="button" className="assignment-open" onClick={() => setOpen(a)}>
                  <span className="ic" aria-hidden="true">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5h-10A.5.5 0 0 1 7 20V3.5zM13.5 3.5V8h4.5M9.5 13h6M9.5 16.5h4" />
                    </svg>
                  </span>
                  <span className="t">{a.title}</span>
                  <span className="cta">צפייה</span>
                </button>
                <div className="assignment-dl">
                  {a.files.map((f) => (
                    <a key={f.src} href={f.src} download aria-label={`הורדה בפורמט ${f.format}`}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
                      </svg>
                      <span className="ltr">{f.format}</span>
                    </a>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
      {navigation}
    </>
  );

  // פרויקט הסיום — באנר רחב ובולט מתחת לנגן
  const finalBanner = finals.map((a) => (
    <section key={a.title} className="final-project" aria-labelledby="fp-title">
      <div className="fp-trophy" aria-hidden="true">
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4z" />
          <path d="M17 6h2.5a1.5 1.5 0 0 1 1.5 1.5V8a4 4 0 0 1-4 4M7 6H4.5A1.5 1.5 0 0 0 3 7.5V8a4 4 0 0 0 4 4" />
        </svg>
      </div>
      <div className="fp-text">
        <span className="fp-badge">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
            <path d="M12 2l2.9 6.3 6.9.7-5.2 4.6 1.5 6.8L12 17l-6.1 3.4 1.5-6.8L2.2 9l6.9-.7z" />
          </svg>
          שלב הגמר של הקורס
        </span>
        <h2 id="fp-title">{a.title}</h2>
        <p>כאן מתחבר כל מה שלמדת לתכנית אחת שלמה — מהגדרת המשתנים ועד עבודה עם קבצים. זה הרגע להראות מה את יודעת.</p>
      </div>
      <div className="fp-actions">
        <button type="button" className="fp-open" onClick={() => setOpen(a)}>
          <span className="shine" />
          לצפייה בפרויקט
        </button>
        <div className="fp-dl">
          {a.files.map((file) => (
            <a key={file.src} href={file.src} download aria-label={`הורדת פרויקט הסיום בפורמט ${file.format}`}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />
              </svg>
              הורדה <span className="ltr">{file.format}</span>
            </a>
          ))}
        </div>
      </div>
    </section>
  ));

  return (
    <>
      {canPlay ? (
        <LessonPlayer
          lessonSlug={lessonSlug}
          initialIndex={initialIndex}
          videos={videos}
          watermark={watermark}
          nextLesson={nextLesson}
          onOpenAssignment={first ? () => setOpen(first) : undefined}
          assignmentIsFinal={first?.final}
          sidebar={side}
        />
      ) : (
        <div className="player">
          <div className="stage">{fallback}</div>
          <aside className="side" aria-label="תוכן השיעור">
            {side}
          </aside>
        </div>
      )}

      {/* פרויקט הסיום — מתחת לסרטון */}
      {finalBanner}

      {/* key — חלון חדש לכל משימה, כך שבחירת הפורמט מתאפסת (PDF קודם) */}
      <AssignmentViewer key={open?.title ?? "closed"} assignment={open} onClose={() => setOpen(null)} />
    </>
  );
}
