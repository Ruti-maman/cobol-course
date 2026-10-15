import Link from "next/link";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { getCourseStats, getPublishedLessons } from "@/lib/course";
import { countLabel, nouns } from "@/lib/hebrew";

const features = [
  {
    hue: "var(--c1)",
    title: "סרטונים קצרים וממוקדים",
    text: "כל שיעור מחולק לכמה סרטונים, כך שאפשר ללמוד בחלקים ולחזור בדיוק לנושא שצריך.",
    icon: <path d="M8 5.5v13l10-6.5-10-6.5z" />,
  },
  {
    hue: "var(--c2)",
    title: "מטלה בכל שיעור",
    text: "תרגול מעשי להורדה בסוף כל שיעור — כי COBOL לומדים כשכותבים קוד.",
    icon: <path d="M7 3.5h7l4 4V20a.5.5 0 0 1-.5.5h-10A.5.5 0 0 1 7 20V3.5zM13.5 3.5V8h4.5M9.5 13h6M9.5 16.5h4" />,
  },
  {
    hue: "var(--c3)",
    title: "המשיכי מאיפה שעצרת",
    text: "האתר זוכר איפה עצרת בכל סרטון ומראה כמה התקדמת בכל שיעור ובקורס כולו.",
    icon: <path d="M12 4a8 8 0 1 0 8 8M12 8v4l3 2M17 3.5l3 .5-.5 3" />,
  },
];

export default function HomePage() {
  const lessons = getPublishedLessons();
  const stats = getCourseStats(lessons);

  return (
    <>
      <SiteHeader />

      <main id="main">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-glow" aria-hidden="true" />
          <div className="wrap hero-grid">
            <div className="hero-l">
              <p className="eyebrow">
                <b>◆</b> קורס דיגיטלי · בעברית · בקצב שלך
              </p>
              <h1 id="hero-title">
                לומדות <em>COBOL</em>, שורה אחר שורה
              </h1>
              <p className="lede">
                הקורס שלוקח אותך ממבנה התכנית הראשונה ועד עבודה עם קבצים, רוטינות, תוכניות שרות ופרויקט סיום —{" "}
                <b>בסרטונים מדויקים, מטלות מעשיות והסברים ברורים</b> של מנחה מנוסה בתחום הקובול.
              </p>
              <dl className="counts">
                <div>
                  <dt>שיעורים</dt>
                  <dd>{stats.lessons}</dd>
                </div>
                <div>
                  <dt>סרטונים</dt>
                  <dd>{stats.videos}</dd>
                </div>
                <div>
                  <dt>מטלות</dt>
                  <dd>{stats.assignments}</dd>
                </div>
              </dl>
              <div className="hero-cta">
                <a className="btn btn-1" href="#join">
                  <span className="shine" />
                  להרשמה לקורס
                </a>
                <a className="btn btn-2" href="#lessons">
                  <span className="shine" />
                  לתוכנית הלימודים
                </a>
              </div>
            </div>
          </div>
        </section>

        <section className="band" id="lessons" aria-labelledby="lessons-title">
          <div className="wrap">
            <div className="head">
              <p className="eyebrow">תוכנית הלימודים</p>
              <h2 id="lessons-title">מה לומדים בקורס</h2>
              <p>
                {countLabel(stats.lessons, nouns.lesson)} ושיעור פתיחה, מהבסיס ועד פרויקט סיום. כל שיעור בונה על
                הקודם.
              </p>
            </div>
            <ol className="lessons" role="list">
              {lessons.map((lesson) => (
                <li key={lesson.slug} className={`lesson${lesson.kind === "intro" ? " intro" : ""}`}>
                  <span className="no ltr" aria-hidden="true">
                    {String(lesson.position).padStart(2, "0")}
                  </span>
                  <h3>
                    <Link className="lesson-link" href={`/lessons/${lesson.slug}`}>
                      {lesson.kind === "intro" ? "פתיחה: " : `שיעור ${lesson.position}: `}
                      {lesson.title}
                    </Link>
                    <span className="meta">{countLabel(lesson.videoCount, nouns.video)}</span>
                  </h3>
                  <p>{lesson.summary}</p>
                  <ul className="chips ltr" aria-label="נושאים">
                    {lesson.topics.map((topic) => (
                      <li key={topic}>{topic}</li>
                    ))}
                  </ul>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="band alt" id="how" aria-labelledby="how-title">
          <div className="wrap">
            <div className="head">
              <p className="eyebrow">איך זה עובד</p>
              <h2 id="how-title">לומדות בנוחות, בלי לפספס</h2>
            </div>
            <div className="cards">
              {features.map((f) => (
                <article className="card" key={f.title} style={{ ["--h" as string]: f.hue }}>
                  <span className="ic" aria-hidden="true">
                    <svg
                      width="22"
                      height="22"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      {f.icon}
                    </svg>
                  </span>
                  <h3>{f.title}</h3>
                  <p>{f.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="band" id="join" aria-labelledby="join-title">
          <div className="wrap">
            <div className="cta-box">
              <p className="eyebrow">
                <b>◆</b> הרשמה
              </p>
              <h2 id="join-title">מוכנה לכתוב את התכנית הראשונה שלך?</h2>
              <p>פרטי המחיר וההרשמה יפורסמו כאן בקרוב.</p>
              <a className="btn btn-1" href="#lessons">
                <span className="shine" />
                לתוכנית הלימודים
              </a>
            </div>
          </div>
        </section>

      </main>

      <SiteFooter />
    </>
  );
}
