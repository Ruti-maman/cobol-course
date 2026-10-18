import {
  deleteLearner,
  extendAccess,
  grantAccess,
  revokeAccess,
} from "@/app/admin/actions";
import { ConfirmButton } from "@/components/admin/ConfirmButton";
import { Flash, flatParams } from "@/components/admin/Flash";
import { daysLeft, fmtDate } from "@/components/admin/format";
import {
  allActivity,
  allEntitlements,
  listAllUsers,
  summarizeActivity,
  summarizeLearners,
  type Learner,
} from "@/lib/admin-data";
import { isAdminEmail } from "@/lib/admin-rules";
import { formatWatchTime } from "@/lib/watch-time";
import { loadPublishedLessons } from "@/lib/lessons-store";

export const metadata = { title: "לומדות · ניהול" };

function Expiry({ learner }: { learner: Learner }) {
  if (learner.status === "pending") return <>—</>;
  if (!learner.expiresAt) return <>ללא תאריך סיום</>;
  const d = daysLeft(learner.expiresAt) ?? 0;
  return (
    <>
      {fmtDate(learner.expiresAt)}
      <small className={d <= 30 ? "warn" : undefined}>
        {d > 0 ? ` (עוד ${d} ימים)` : " (הסתיים)"}
      </small>
    </>
  );
}

/** כניסה אחרונה לאתר או צפייה אחרונה — המאוחרת מביניהן */
function lastActive(l: Learner): string | null {
  const a = l.activity.lastSeen;
  const b = l.lastSignIn;
  return !a ? b : !b ? a : a > b ? a : b;
}

function Rows({ list, empty }: { list: Learner[]; empty: string }) {
  if (!list.length) return <p className="adm-empty">{empty}</p>;
  return (
    <div className="adm-table-wrap">
      <table className="adm-table">
        <thead>
          <tr>
            <th>מייל</th>
            <th>נרשמה</th>
            <th>פעילות אחרונה</th>
            <th>זמן צפייה</th>
            <th>כניסות לשיעורים</th>
            <th>שיעורים פתוחים</th>
            <th>גישה עד</th>
            <th>הערה</th>
            <th>פעולות</th>
          </tr>
        </thead>
        <tbody>
          {list.map((l) => (
            <tr key={l.id}>
              <td className="email" data-label="מייל">
                <span className="ltr">{l.email}</span>
              </td>
              <td data-label="נרשמה">{fmtDate(l.registeredAt)}</td>
              <td data-label="פעילות אחרונה">{fmtDate(lastActive(l))}</td>
              <td data-label="זמן צפייה">
                {formatWatchTime(l.activity.seconds)}
              </td>
              <td data-label="כניסות לשיעורים">
                {l.activity.views
                  ? `${l.activity.views} (${l.activity.days === 1 ? "ביום אחד" : `ב-${l.activity.days} ימים`})`
                  : "—"}
              </td>
              <td data-label="שיעורים פתוחים">{l.lessons}</td>
              <td data-label="גישה עד">
                <Expiry learner={l} />
              </td>
              <td className="note" data-label="הערה">
                {l.note ?? ""}
              </td>
              <td className="acts">
                {l.status === "pending" ? (
                  <form action={grantAccess}>
                    <input type="hidden" name="email" value={l.email} />
                    <input type="hidden" name="days" value="365" />
                    <button className="btn btn-1 sm" type="submit">
                      אישור לשנה
                    </button>
                  </form>
                ) : (
                  <>
                    <form action={extendAccess}>
                      <input type="hidden" name="userId" value={l.id} />
                      <input type="hidden" name="email" value={l.email} />
                      <input type="hidden" name="days" value="365" />
                      <button
                        className={`btn sm ${l.status === "expired" ? "btn-1" : "btn-2"}`}
                        type="submit"
                      >
                        הארכה בשנה
                      </button>
                    </form>
                    <form action={revokeAccess}>
                      <input type="hidden" name="userId" value={l.id} />
                      <input type="hidden" name="email" value={l.email} />
                      <ConfirmButton
                        className="btn btn-2 sm danger"
                        message={`לבטל את הגישה של ${l.email}?\n\nכל השיעורים ייסגרו בפניה מיד. החשבון עצמו נשאר, ואפשר לאשר אותה מחדש בכל רגע.`}
                      >
                        ביטול גישה
                      </ConfirmButton>
                    </form>
                  </>
                )}
                <form action={deleteLearner}>
                  <input type="hidden" name="userId" value={l.id} />
                  <input type="hidden" name="email" value={l.email} />
                  <ConfirmButton
                    className="btn btn-2 sm danger"
                    message={`להסיר את ${l.email} מהאתר?

החשבון יימחק לגמרי: הגישה לשיעורים ונתוני הפעילות שלה. אי אפשר לבטל. אם היא תתחבר שוב, היא תופיע כהרשמה חדשה שממתינה לאישור.`}
                  >
                    הסרה
                  </ConfirmButton>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function LearnersPage(
  props: PageProps<"/admin/learners">,
) {
  const params = flatParams(await props.searchParams);
  const q = (params.q ?? "").trim().toLowerCase();
  const [learners, lessons] = await Promise.all([
    Promise.all([
      listAllUsers(),
      allEntitlements().catch(() => []),
      allActivity(),
    ])
      .then(([users, rows, activity]) =>
        summarizeLearners(users, rows, undefined, summarizeActivity(activity)),
      )
      .catch(() => null),
    loadPublishedLessons(),
  ]);
  const shown = (learners ?? []).filter(
    (l) => !q || l.email.toLowerCase().includes(q),
  );
  // המנהלות רואות הכול בלי אישור ובלי תאריך סיום — לא מופיעות ברשימות הלומדות.
  const isAdmin = (l: Learner) =>
    isAdminEmail(l.email, process.env.ADMIN_EMAILS);
  const admins = shown.filter(isAdmin);
  const by = (s: Learner["status"]) =>
    shown.filter((l) => !isAdmin(l) && l.status === s);

  return (
    <>
      <div className="adm-head">
        <p className="eyebrow">לומדות</p>
        <h1>לומדות וגישה לקורס</h1>
      </div>
      <Flash params={params} />

      <p className="adm-hint">
        זמן צפייה = כמה זמן סרטון באמת התנגן אצלה. כניסות לשיעורים = כמה פעמים
        פתחה דף שיעור.
      </p>

      <section className="adm-box">
        <h2>אישור גישה לפי מייל</h2>
        <p className="adm-hint">
          פותח את כל השיעורים המפורסמים כרגע ({lessons.length}). אם הלומדת עוד
          לא נרשמה — נוצר לה חשבון, והיא תתחבר עם חשבון ה-Google של המייל הזה.
        </p>
        <form action={grantAccess} className="adm-form row">
          <label>
            מייל
            <input
              name="email"
              type="email"
              required
              dir="ltr"
              autoComplete="off"
              placeholder="name@example.com"
            />
          </label>
          <label>
            לכמה זמן
            <select name="days" defaultValue="365">
              <option value="365">שנה</option>
              <option value="730">שנתיים</option>
              <option value="183">חצי שנה</option>
              <option value="30">חודש</option>
            </select>
          </label>
          <label className="grow">
            הערה (לא חובה)
            <input
              name="note"
              maxLength={300}
              placeholder="למשל: העברה בנקאית 18.10"
            />
          </label>
          <button className="btn btn-1" type="submit">
            אישור גישה
          </button>
        </form>
      </section>

      <form className="adm-search" role="search">
        <input
          name="q"
          type="search"
          defaultValue={params.q ?? ""}
          placeholder="חיפוש לפי מייל…"
          dir="ltr"
          aria-label="חיפוש לפי מייל"
        />
        <button className="btn btn-2 sm" type="submit">
          חיפוש
        </button>
      </form>

      {learners === null ? (
        <p className="adm-flash bad">
          לא הצלחנו לטעון את רשימת הלומדות. נסי לרענן את הדף.
        </p>
      ) : (
        <>
          {admins.length > 0 && (
            <p className="adm-flash">
              <b>מנהלת — גישה מלאה לכל השיעורים, בלי אישור ובלי תאריך סיום:</b>{" "}
              {admins.map((a) => (
                <bdi key={a.id} className="ltr">
                  {a.email}{" "}
                </bdi>
              ))}
            </p>
          )}
          <section className="adm-sec" id="pending">
            <h2>
              ממתינות לאישור{" "}
              <span className="adm-count">{by("pending").length}</span>
            </h2>
            <p className="adm-hint">
              נרשמו לאתר (התחברו עם Google) ועדיין אין להן גישה. אחרי שהתשלום
              התקבל — &quot;אישור לשנה&quot;.
            </p>
            <Rows
              list={by("pending")}
              empty="אין כרגע הרשמות שממתינות לאישור."
            />
          </section>
          <section className="adm-sec" id="active">
            <h2>
              פעילות <span className="adm-count">{by("active").length}</span>
            </h2>
            <Rows list={by("active")} empty="עדיין אין לומדות עם גישה פעילה." />
          </section>
          <section className="adm-sec" id="expired">
            <h2>
              התוקף הסתיים{" "}
              <span className="adm-count">{by("expired").length}</span>
            </h2>
            <Rows list={by("expired")} empty="אין." />
          </section>
        </>
      )}
    </>
  );
}
