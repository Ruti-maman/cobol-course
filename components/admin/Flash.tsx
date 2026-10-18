// הודעת הצלחה / שגיאה אחרי פעולה בצד הניהול. רק קודים קבועים — לא מציגים טקסט חופשי מהכתובת.

const ok: Record<string, (p: Params) => string> = {
  granted: (p) => `הגישה אושרה ל-${p.email}. היא יכולה להתחבר עכשיו עם קוד למייל.`,
  extended: (p) => `הגישה של ${p.email} הוארכה.`,
  revoked: (p) => `הגישה של ${p.email} בוטלה.`,
  created: () => "השיעור נוצר כטיוטה. עכשיו אפשר להעלות אליו סרטונים ומטלות, ולפרסם כשהוא מוכן.",
  saved: () => "השינויים נשמרו.",
  published: () => "השיעור פורסם ומופיע עכשיו באתר.",
  hidden: () => "השיעור הוסתר מהאתר (נשמר כטיוטה).",
  moved: () => "הסדר עודכן.",
  deleted: () => "הקובץ נמחק.",
  opened: (p) => `השיעור נפתח ל-${p.count ?? 0} לומדות עם גישה פעילה.`,
};

const err: Record<string, string> = {
  email: "כתובת המייל לא תקינה.",
  input: "הפרטים שנשלחו לא תקינים. נסי שוב.",
  title: "יש למלא כותרת (2 תווים לפחות).",
  user: "לא הצלחנו למצוא או ליצור חשבון למייל הזה.",
  migration: "צריך קודם להריץ את קובץ ההגדרה db/migrations/0003_admin.sql במסד הנתונים (פעם אחת).",
  db: "השמירה במסד הנתונים נכשלה. נסי שוב בעוד רגע.",
  file: "הקובץ לא נמצא.",
};

type Params = Record<string, string | undefined>;

export function Flash({ params }: { params: Params }) {
  const success = params.ok && ok[params.ok]?.(params);
  const failure = params.err && err[params.err];
  if (!success && !failure) return null;
  return (
    <p className={`adm-flash${failure ? " bad" : ""}`} role={failure ? "alert" : "status"}>
      {failure || success}
    </p>
  );
}

export function flatParams(sp: Record<string, string | string[] | undefined>): Params {
  return Object.fromEntries(Object.entries(sp).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]));
}
