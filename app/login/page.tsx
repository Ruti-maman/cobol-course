import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";

export const metadata = { title: "כניסה ללומדות · קורס COBOL" };

// דף זמני — ההתחברות ב-OTP תיבנה בשלב 2.
export default function LoginPage() {
  return (
    <>
      <SiteHeader />
      <main id="main" className="wrap placeholder">
        <p className="eyebrow">
          <b>◆</b> אזור הלומדות
        </p>
        <h1>הכניסה תיפתח בקרוב</h1>
        <p>כאן תוכלי להתחבר עם קוד חד-פעמי ולהמשיך ללמוד מאיפה שעצרת.</p>
        <Link className="btn btn-2" href="/">
          חזרה לדף הבית
        </Link>
      </main>
    </>
  );
}
