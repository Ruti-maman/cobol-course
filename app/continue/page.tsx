import { ContinueRedirect } from "@/components/ContinueRedirect";
import { SiteHeader } from "@/components/SiteHeader";
import { loadPublishedLessons } from "@/lib/lessons-store";

export const metadata = { title: "המשיכי מאיפה שעצרת · קורס COBOL" };

// "המשיכי מאיפה שעצרת": הדפדפן זוכר את הסרטון האחרון שנצפה ומעביר אליו (ההרשאה נבדקת בדף השיעור עצמו).
// השיעורים מתעדכנים מממשק הניהול (revalidatePath); בדיקה נוספת לכל היותר כל 5 דקות.
export const revalidate = 300;

export default async function ContinuePage() {
  const lessons = await loadPublishedLessons();
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
