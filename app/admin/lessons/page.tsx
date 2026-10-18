import Link from "next/link";
import { createLesson, moveLesson, setLessonStatus } from "@/app/admin/actions";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { Flash, flatParams } from "@/components/admin/Flash";
import { getPublishedLessons } from "@/lib/course";
import { countLabel, nouns } from "@/lib/hebrew";
import { loadAllLessons } from "@/lib/lessons-store";

export const metadata = { title: "שיעורים · ניהול" };

export default async function LessonsAdminPage(props: PageProps<"/admin/lessons">) {
  const params = flatParams(await props.searchParams);
  const { lessons, fromDb } = await loadAllLessons();
  // המספר שהלומדות רואות ("שיעור 3") — לפי הסדר של השיעורים המפורסמים בלבד.
  const number = new Map(getPublishedLessons(lessons).map((l) => [l.slug, l.position]));

  return (
    <>
      <div className="adm-head">
        <p className="eyebrow">ניהול הקורס</p>
        <h1>שיעורים</h1>
      </div>
      <Flash params={params} />
      {!fromDb && (
        <p className="adm-flash bad" role="alert">
          השיעורים מוצגים כרגע מתוך הקוד, לקריאה בלבד. כדי לערוך, להוסיף ולשנות סדר — יש להריץ פעם אחת את{" "}
          <code className="ltr">db/migrations/0003_admin.sql</code> ב-Supabase.
        </p>
      )}

      <ol className="adm-lessons">
        {lessons.map((l, i) => (
          <li key={l.slug} data-status={l.status}>
            <span className="no ltr">{l.status === "published" ? String(number.get(l.slug) ?? "").padStart(2, "0") : "--"}</span>
            <div className="body">
              <Link href={`/admin/lessons/${l.slug}`} className="title">
                {l.kind === "intro" ? "פתיחה: " : ""}
                {l.title}
              </Link>
              <span className="meta">
                <span className={`pill ${l.status}`}>{l.status === "published" ? "מפורסם" : "טיוטה"}</span>
                {countLabel(l.videoCount, nouns.video)} · {l.assignmentCount ? countLabel(l.assignmentCount, nouns.assignment) : "בלי מטלה"}
              </span>
            </div>
            {fromDb && (
              <div className="acts">
                <form action={moveLesson}>
                  <input type="hidden" name="slug" value={l.slug} />
                  <button className="icon-btn" name="dir" value="up" disabled={i === 0} aria-label={`להזיז למעלה: ${l.title}`}>
                    ▲
                  </button>
                  <button className="icon-btn" name="dir" value="down" disabled={i === lessons.length - 1} aria-label={`להזיז למטה: ${l.title}`}>
                    ▼
                  </button>
                </form>
                <form action={setLessonStatus}>
                  <input type="hidden" name="slug" value={l.slug} />
                  {l.status === "published" ? (
                    <>
                      <input type="hidden" name="status" value="draft" />
                      <ConfirmButton
                        className="btn btn-2 sm"
                        message={`להסתיר את "${l.title}" מהאתר?\n\nהשיעור לא יופיע ללומדות עד שתפרסמי אותו שוב. הסרטונים, המטלות וההתקדמות שלהן נשמרים.`}
                      >
                        הסתרה
                      </ConfirmButton>
                    </>
                  ) : (
                    <>
                      <input type="hidden" name="status" value="published" />
                      <button className="btn btn-1 sm" type="submit">
                        פרסום
                      </button>
                    </>
                  )}
                </form>
                <Link className="btn btn-2 sm" href={`/admin/lessons/${l.slug}`}>
                  עריכה
                </Link>
              </div>
            )}
          </li>
        ))}
      </ol>

      {fromDb && (
        <section className="adm-box" id="new">
          <h2>הוספת שיעור חדש</h2>
          <p className="adm-hint">
            השיעור נוצר כטיוטה בסוף הרשימה — לומדות לא רואות אותו עד שתפרסמי. אחרי היצירה תגיעי לדף השיעור, שם מעלים סרטונים ומטלות.
          </p>
          <form action={createLesson} className="adm-form">
            <label>
              כותרת השיעור
              <input name="title" required minLength={2} maxLength={120} placeholder="למשל: מיון ומיזוג קבצים" />
            </label>
            <label>
              תיאור קצר
              <textarea name="summary" maxLength={400} rows={2} placeholder="משפט או שניים על מה לומדים בשיעור" />
            </label>
            <label>
              נושאים (מופרדים בפסיק)
              <input name="topics" maxLength={600} dir="ltr" placeholder="SORT, MERGE, RELEASE" />
            </label>
            <button className="btn btn-1" type="submit">
              יצירת השיעור
            </button>
          </form>
        </section>
      )}
    </>
  );
}
