import { fmtDateTime } from "@/components/admin/format";
import { recentAudit } from "@/lib/admin-data";

export const metadata = { title: "יומן פעולות · ניהול" };

const labels: Record<string, string> = {
  grant: "אישור גישה",
  extend: "הארכת גישה",
  revoke: "ביטול גישה",
  "learner.delete": "הסרת לומדת",
  "lesson.create": "שיעור חדש",
  "lesson.update": "עריכת שיעור",
  "lesson.publish": "פרסום שיעור",
  "lesson.hide": "הסתרת שיעור",
  "lesson.move": "שינוי סדר",
  "lesson.open-to-all": "פתיחת שיעור ללומדות",
  "media.upload": "העלאת קובץ",
  "media.delete": "מחיקת קובץ",
};

function summary(details: Record<string, unknown>): string {
  const pick = (k: string) => (typeof details[k] === "string" || typeof details[k] === "number" ? String(details[k]) : "");
  return [pick("email"), pick("title") || pick("slug"), pick("file"), pick("note")].filter(Boolean).join(" · ");
}

export default async function LogPage() {
  const entries = await recentAudit();
  return (
    <>
      <div className="adm-head">
        <p className="eyebrow">יומן פעולות</p>
        <h1>יומן פעולות</h1>
        <p className="adm-hint">כל פעולה בצד הניהול נרשמת כאן: מי, מה ומתי. 200 הפעולות האחרונות.</p>
      </div>
      {entries.length ? (
        <div className="adm-table-wrap">
          <table className="adm-table">
            <thead>
              <tr>
                <th>מתי</th>
                <th>פעולה</th>
                <th>פרטים</th>
                <th>מנהלת</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id}>
                  <td data-label="מתי">{fmtDateTime(e.created_at)}</td>
                  <td data-label="פעולה">{labels[e.action] ?? e.action}</td>
                  <td data-label="פרטים">{summary(e.details)}</td>
                  <td className="ltr email" data-label="מנהלת">
                    {e.admin_email}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="adm-empty">עדיין אין פעולות ביומן.</p>
      )}
    </>
  );
}
