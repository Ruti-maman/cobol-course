import { ContinueRedirect } from "@/components/ContinueRedirect";
import { SiteHeader } from "@/components/SiteHeader";
import { getPublishedLessons } from "@/lib/course";

export const metadata = { title: "המשיכי מאיפה שעצרת · קורס COBOL" };

// "המשיכי מאיפה שעצרת": הדפדפן זוכר את הסרטון האחרון שנצפה ומעביר אליו (ההרשאה נבדקת בדף השיעור עצמו).
export default function ContinuePage() {
  const lessons = getPublishedLessons();
  const first = lessons[0];
  return (
    <>
      <SiteHeader />
      <main id="main" className="wrap placeholder">
        <p className="eyebrow">המשיכי מאיפה שעצרת</p>
        <h1>טוענת את הסרטון האחרון שלך…</h1>
        <ContinueRedirect fallback={first ? `/lessons/${first.slug}` : "/"} knownSlugs={lessons.map((l) => l.slug)} />
      </main>
    </>
  );
}
