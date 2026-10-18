import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteMedia, openLessonToLearners, setLessonStatus, updateLesson } from "@/app/admin/actions";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { Flash, flatParams } from "@/components/admin/Flash";
import { fmtDate, fmtSize } from "@/components/admin/format";
import { MediaUploader } from "@/components/admin/MediaUploader";
import { lessonMedia } from "@/lib/admin-data";
import { loadAllLessons } from "@/lib/lessons-store";
import { buildLessonFiles } from "@/lib/media-storage";

export const metadata = { title: "עריכת שיעור · ניהול" };

export default async function LessonEditPage(props: PageProps<"/admin/lessons/[slug]">) {
  const { slug } = await props.params;
  const params = flatParams(await props.searchParams);
  const { lessons, fromDb } = await loadAllLessons();
  const lesson = lessons.find((l) => l.slug === slug);
  if (!lesson) notFound();

  const media = await lessonMedia(lesson.sourceDir);
  const byName = new Map(media.map((m) => [m.file_name, m]));
  const { videos, assignments } = buildLessonFiles(media.map((m) => m.file_name));
  const files = [
    ...videos.map((v) => ({ ...v, kind: "סרטון" })),
    ...assignments.map((a) => ({ file: a.file, title: a.title, kind: `מטלה · ${a.format}` })),
  ];

  return (
    <>
      <div className="adm-head">
        <p className="eyebrow">
          <Link href="/admin/lessons">→ כל השיעורים</Link>
        </p>
        <h1>{lesson.title}</h1>
        <p className="adm-hint">
          <span className={`pill ${lesson.status}`}>{lesson.status === "published" ? "מפורסם" : "טיוטה"}</span> כתובת:{" "}
          <span className="ltr">/lessons/{lesson.slug}</span> · תיקייה באחסון: <span className="ltr">{lesson.sourceDir}</span>
        </p>
      </div>
      <Flash params={params} />

      <div className="adm-actions">
        <Link className="btn btn-2" href={`/lessons/${lesson.slug}`} target="_blank">
          תצוגה מקדימה ↗
        </Link>
        {fromDb && (
          <form action={setLessonStatus}>
            <input type="hidden" name="slug" value={lesson.slug} />
            <input type="hidden" name="from" value="edit" />
            {lesson.status === "published" ? (
              <>
                <input type="hidden" name="status" value="draft" />
                <ConfirmButton
                  className="btn btn-2"
                  message={`להסתיר את "${lesson.title}" מהאתר?\n\nהשיעור לא יופיע ללומדות עד שתפרסמי אותו שוב. הסרטונים, המטלות וההתקדמות שלהן נשמרים.`}
                >
                  הסתרה מהאתר
                </ConfirmButton>
              </>
            ) : (
              <>
                <input type="hidden" name="status" value="published" />
                <ConfirmButton
                  className="btn btn-1"
                  message={`לפרסם את "${lesson.title}"?\n\nהשיעור יופיע באתר מיד. לומדות קיימות לא יקבלו אליו גישה אוטומטית — לשם כך יש את הכפתור "פתיחה לכל הלומדות הפעילות".`}
                >
                  פרסום באתר
                </ConfirmButton>
              </>
            )}
          </form>
        )}
      </div>

      {fromDb ? (
        <section className="adm-box">
          <h2>פרטי השיעור</h2>
          <form action={updateLesson} className="adm-form">
            <input type="hidden" name="slug" value={lesson.slug} />
            <label>
              כותרת
              <input name="title" required minLength={2} maxLength={120} defaultValue={lesson.title} />
            </label>
            <label>
              תיאור קצר
              <textarea name="summary" maxLength={400} rows={2} defaultValue={lesson.summary} />
            </label>
            <label>
              נושאים (מופרדים בפסיק)
              <input name="topics" maxLength={600} dir="ltr" defaultValue={lesson.topics.join(", ")} />
            </label>
            <button className="btn btn-1" type="submit">
              שמירה
            </button>
          </form>
        </section>
      ) : (
        <p className="adm-flash bad">
          כדי לערוך את השיעור ולהעלות קבצים — יש להריץ קודם את <code className="ltr">db/migrations/0003_admin.sql</code> ב-Supabase.
        </p>
      )}

      <section className="adm-box">
        <h2>סרטונים ומטלות</h2>
        <p className="adm-hint">
          הסדר נקבע לפי שם הקובץ. הסרטונים נקראים באתר &quot;חלק 1&quot;, &quot;חלק 2&quot;… (שם בעברית נשאר כמו שהוא), וקובץ
          &quot;Practice Lesson 3&quot; מוצג כ&quot;תרגול שיעור 3&quot;. כשיש אותה מטלה ב-PDF וב-Word — מוצג ה-PDF.
        </p>
        {files.length ? (
          <div className="adm-table-wrap">
            <table className="adm-table">
              <thead>
                <tr>
                  <th>מוצג באתר</th>
                  <th>סוג</th>
                  <th>שם הקובץ</th>
                  <th>גודל</th>
                  <th>הועלה</th>
                  {fromDb && <th>פעולות</th>}
                </tr>
              </thead>
              <tbody>
                {files.map((f) => {
                  const row = byName.get(f.file);
                  return (
                    <tr key={f.file}>
                      <td data-label="מוצג באתר">{f.title}</td>
                      <td data-label="סוג">{f.kind}</td>
                      <td className="ltr email" data-label="שם הקובץ">
                        {f.file}
                      </td>
                      <td data-label="גודל">{row ? fmtSize(row.size_bytes) : ""}</td>
                      <td data-label="הועלה">{fmtDate(row?.uploaded_at)}</td>
                      {fromDb && (
                      <td className="acts">
                        <form action={deleteMedia}>
                          <input type="hidden" name="slug" value={lesson.slug} />
                          <input type="hidden" name="file" value={f.file} />
                          <ConfirmButton
                            className="btn btn-2 sm danger"
                            message={`למחוק את "${f.file}"?\n\nהקובץ יימחק מהאחסון ולא יופיע יותר בשיעור. אי אפשר לבטל — אם תרצי אותו שוב, יהיה צריך להעלות אותו מחדש.`}
                          >
                            מחיקה
                          </ConfirmButton>
                        </form>
                      </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="adm-empty">עדיין אין קבצים בשיעור הזה.</p>
        )}
        {fromDb && <MediaUploader slug={lesson.slug} />}
      </section>

      {fromDb && lesson.status === "published" && (
        <section className="adm-box">
          <h2>פתיחה ללומדות קיימות</h2>
          <p className="adm-hint">
            שיעור חדש לא נפתח אוטומטית למי שכבר קנתה. הכפתור הזה פותח את השיעור לכל מי שיש לה גישה פעילה עכשיו — עד אותו תאריך סיום
            שיש לה.
          </p>
          <form action={openLessonToLearners}>
            <input type="hidden" name="slug" value={lesson.slug} />
            <ConfirmButton className="btn btn-2" message={`לפתוח את "${lesson.title}" לכל הלומדות שיש להן גישה פעילה?`}>
              פתיחה לכל הלומדות הפעילות
            </ConfirmButton>
          </form>
        </section>
      )}
    </>
  );
}
