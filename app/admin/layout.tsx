import type { Metadata } from "next";
import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import { requireAdmin } from "@/lib/admin-server";
import { signOutAction } from "@/app/login/actions";

// צד הניהול — נתיב נפרד, נבדק בשרת בכל בקשה (CLAUDE.md סעיף 6.6). לא מופיע במנועי חיפוש.
export const metadata: Metadata = {
  title: "ניהול · קורס COBOL",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await requireAdmin();
  return (
    <div className="adm">
      <header className="bar">
        <div className="wrap bar-in wide">
          <Link className="brand" href="/admin">
            <span className="sig ltr" aria-hidden="true">
              CB
            </span>
            <b>ניהול הקורס</b>
          </Link>
          <nav aria-label="ניווט בניהול" className="adm-nav">
            <Link href="/admin">סקירה</Link>
            <Link href="/admin/learners">לומדות</Link>
            <Link href="/admin/lessons">שיעורים</Link>
            <Link href="/admin/log">יומן פעולות</Link>
            <Link href="/">לאתר ←</Link>
          </nav>
          <div className="tools">
            <ThemeToggle />
            <form action={signOutAction}>
              <button className="kbtn" type="submit" title={admin.email}>
                יציאה
              </button>
            </form>
          </div>
        </div>
      </header>
      <main id="main" className="wrap wide adm-main">
        {children}
      </main>
    </div>
  );
}
