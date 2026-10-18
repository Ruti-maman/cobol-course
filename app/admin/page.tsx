import Link from "next/link";
import { daysLeft } from "@/components/admin/format";
import { allEntitlements, listAllUsers, migrationStatus, summarizeLearners } from "@/lib/admin-data";
import { loadAllLessons } from "@/lib/lessons-store";

export default async function AdminHome() {
  const [status, { lessons, fromDb }] = await Promise.all([migrationStatus(), loadAllLessons()]);
  const learners = await Promise.all([listAllUsers(), allEntitlements().catch(() => [])])
    .then(([users, rows]) => summarizeLearners(users, rows))
    .catch(() => null);

  const count = (s: string) => learners?.filter((l) => l.status === s).length ?? 0;
  const expiringSoon =
    learners?.filter((l) => {
      const d = l.status === "active" ? daysLeft(l.expiresAt) : null;
      return d !== null && d <= 30;
    }).length ?? 0;
  const ready = status.lessonsTable && status.expiryColumn && status.auditTable;
  const drafts = lessons.filter((l) => l.status === "draft").length;

  return (
    <>
      <div className="adm-head">
        <p className="eyebrow">ניהול הקורס</p>
        <h1>סקירה</h1>
      </div>

      {!ready && (
        <div className="adm-flash bad" role="alert">
          <b>צעד אחד לפני שמתחילות:</b> יש להריץ פעם אחת את הקובץ <code className="ltr">db/migrations/0003_admin.sql</code> ב-Supabase
          (SQL Editor ← להדביק את כל הקובץ ← Run). עד אז האתר עובד כרגיל, אבל אי אפשר לשמור תוקף לגישה, להוסיף שיעורים או לנהל
          קבצים.
        </div>
      )}

      <div className="adm-cards">
        <Link href="/admin/learners#pending" className="adm-card">
          <span>ממתינות לאישור</span>
          <b>{count("pending")}</b>
          <small>נרשמו לאתר ועדיין אין להן גישה</small>
        </Link>
        <Link href="/admin/learners#active" className="adm-card">
          <span>לומדות פעילות</span>
          <b>{count("active")}</b>
          <small>{expiringSoon ? `${expiringSoon} מסתיימות ב-30 הימים הקרובים` : "גישה בתוקף"}</small>
        </Link>
        <Link href="/admin/learners#expired" className="adm-card">
          <span>התוקף הסתיים</span>
          <b>{count("expired")}</b>
          <small>אפשר להאריך בלחיצה</small>
        </Link>
        <Link href="/admin/lessons" className="adm-card">
          <span>שיעורים מפורסמים</span>
          <b>{lessons.filter((l) => l.status === "published").length}</b>
          <small>
            {drafts ? `${drafts} טיוטות` : "אין טיוטות"}
            {fromDb ? "" : " · מהקוד (לפני ההגדרה)"}
          </small>
        </Link>
      </div>

      {learners === null && <p className="adm-flash bad">לא הצלחנו לטעון את רשימת הלומדות. נסי לרענן את הדף.</p>}

      <section className="adm-box">
        <h2>איך מאשרים לומדת חדשה?</h2>
        <ol className="adm-steps">
          <li>הלומדת נכנסת לאתר ב&quot;כניסה ללומדות&quot; ולוחצת &quot;המשיכי עם Google&quot; — כך היא נרשמת.</li>
          <li>
            אחרי שהתשלום התקבל: בדף <Link href="/admin/learners">לומדות</Link> לוחצים &quot;אישור לשנה&quot; ליד המייל שלה (או מקלידים
            מייל ידנית).
          </li>
          <li>מאותו רגע כל השיעורים המפורסמים פתוחים לה לשנה. לקראת הסיום אפשר להאריך בלחיצה.</li>
        </ol>
      </section>
    </>
  );
}
